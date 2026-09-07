import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from docx import Document
from fastapi.testclient import TestClient

from main import app
from models.document import Change
from services.ai.analyzer import InvalidAnalysisResponse, parse_analyze_response
from services.exporter import apply_changes_to_docx
from services.parser import parse_docx
from services.resume_state import apply_changes_to_parsed_document


class SuggestionFlowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'resume.docx'
        document = Document()
        document.add_paragraph('Built reporting tools for the operations team.')
        document.add_paragraph('Worked with stakeholders to improve reporting.')
        document.save(self.source)
        self.doc = parse_docx(self.source)
        self.client = TestClient(app)

    def change(self, **overrides):
        paragraph = self.doc.paragraphs[0]
        fields = dict(paragraph_id=paragraph.paragraph_id, start=paragraph.start, end=paragraph.end,
                      original=paragraph.text, replacement='Built operations reporting tools.')
        return Change(**(fields | overrides))

    def test_analysis_rejects_malformed_results_and_accepts_explicit_empty(self):
        for response in ['not JSON', '{}', '[]', '{"suggestions":[{}]}']:
            with self.subTest(response=response), self.assertRaises(InvalidAnalysisResponse):
                parse_analyze_response(response, self.doc)
        self.assertEqual(parse_analyze_response('{"suggestions":[]}', self.doc), [])

    def test_suggestions_use_current_text_and_original_export_anchors(self):
        effective = apply_changes_to_parsed_document(self.doc, [self.change()])
        result = parse_analyze_response(json.dumps({'suggestions': [{
            'paragraph_id': 'p1', 'reason': 'Clarify collaboration.',
            'alternatives': ['Partnered with stakeholders on reporting.', 'Improved reporting with stakeholders.', 'Collaborated on reporting improvements.'],
        }, {
            'paragraph_id': 'p0', 'reason': 'Make the wording concise.',
            'alternatives': ['Created operations reporting tools.', 'Developed tools for operations reporting.', 'Delivered reporting tools for operations.'],
        }]}), effective)
        self.assertEqual(result[0].paragraph_id, 'p0')
        self.assertEqual(result[0].original_text, self.change().replacement)
        self.assertEqual(result[0].end, self.doc.paragraphs[0].end)
        output = self.root / 'result.docx'
        apply_changes_to_docx(self.source, self.doc, [self.change(replacement=result[0].alternatives[0])], output)
        self.assertEqual(Document(output).paragraphs[0].text, result[0].alternatives[0])
        apply_changes_to_docx(self.source, self.doc, [], output)
        self.assertEqual(Document(output).paragraphs[0].text, self.doc.paragraphs[0].text)

    def test_analysis_and_export_reject_the_same_invalid_changes(self):
        for changes in [[self.change(original='stale')], [self.change(paragraph_id='missing')],
                        [self.change(start=1)], [self.change(), self.change()]]:
            with self.subTest(changes=changes):
                with self.assertRaises(ValueError):
                    apply_changes_to_parsed_document(self.doc, changes)
                with self.assertRaises(ValueError):
                    apply_changes_to_docx(self.source, self.doc, changes, self.root / 'invalid.docx')

    def test_uploads_with_identical_names_are_isolated(self):
        stored = {}
        def store(doc, path):
            stored[doc.doc_id] = path
        with patch('routers.upload.UPLOAD_DIR', self.root), patch('routers.upload.document_repository.store_document', side_effect=store):
            first = self.client.post('/api/upload', files={'file': ('resume.docx', self.source.read_bytes())})
            document = Document()
            document.add_paragraph('A different resume.')
            data = io.BytesIO()
            document.save(data)
            second = self.client.post('/api/upload', files={'file': ('resume.docx', data.getvalue())})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        first_path = stored[first.json()['doc_id']]
        second_path = stored[second.json()['doc_id']]
        self.assertNotEqual(first_path, second_path)
        self.assertEqual(Document(first_path).paragraphs[0].text, self.doc.paragraphs[0].text)
        self.assertEqual(Document(second_path).paragraphs[0].text, 'A different resume.')

    def test_analysis_failure_is_not_a_successful_empty_result(self):
        with patch('routers.analyze.document_repository.get_document', return_value=self.doc), \
             patch('routers.analyze.OPENROUTER_API_KEY', 'test'), \
             patch('services.ai.analyzer.call_llm', return_value='invalid'):
            response = self.client.post('/api/analyze', json={'doc_id': self.doc.doc_id, 'job_description': 'Reporting engineer'})
        self.assertEqual(response.status_code, 502)
        self.assertIn('try again', response.json()['detail'])

    def test_removed_endpoints_are_unavailable(self):
        for endpoint in ['/api/chat', '/api/suggest']:
            self.assertEqual(self.client.post(endpoint, json={}).status_code, 404)


if __name__ == '__main__':
    unittest.main()
