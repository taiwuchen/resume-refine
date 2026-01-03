import type { Suggestion } from '../types';
import './SuggestionPopup.css';

interface SuggestionPopupProps {
    suggestion: Suggestion;
    position: { x: number; y: number };
    onAccept: (replacement: string) => void;
    onDismiss: () => void;
    onRefresh: () => void;
}

export function SuggestionPopup({
    suggestion,
    position,
    onAccept,
    onDismiss,
    onRefresh,
}: SuggestionPopupProps) {
    return (
        <div
            className="suggestion-popup"
            style={{ left: position.x, top: position.y }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="popup-header">
                <span className="popup-title">Suggestions</span>
                <div className="popup-actions">
                    <button className="popup-btn refresh" onClick={onRefresh} title="Refresh">
                        ↻
                    </button>
                    <button className="popup-btn dismiss" onClick={onDismiss} title="Dismiss">
                        ×
                    </button>
                </div>
            </div>

            <div className="popup-original">
                <span className="label">Original:</span>
                <p>{suggestion.original_text}</p>
            </div>

            <div className="popup-alternatives">
                {suggestion.alternatives.map((alt, idx) => (
                    <button
                        key={idx}
                        className="alternative-option"
                        onClick={() => onAccept(alt)}
                    >
                        <span className="option-number">{idx + 1}</span>
                        <span className="option-text">{alt}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
