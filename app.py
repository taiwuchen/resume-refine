import streamlit as st
import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import base64

from processor import process_resume_for_job

st.set_page_config(page_title="Resume Refine", page_icon="📝", layout="wide")

st.title("📝 Resume Refine")
st.markdown("Optimize your resume for multiple job descriptions in parallel.")

# Initialize state
if "jobs" not in st.session_state:
    st.session_state.jobs = []
if "processing" not in st.session_state:
    st.session_state.processing = False

# Sidebar: Upload Resume
with st.sidebar:
    st.header("1. Base Resume")
    uploaded_file = st.file_uploader("Upload your DOCX resume", type=["docx"])
    
    st.divider()
    st.header("2. Job Descriptions")
    
    if "jd_list" not in st.session_state:
        st.session_state.jd_list = [""]

    def add_jd():
        st.session_state.jd_list.append("")

    for i, jd in enumerate(st.session_state.jd_list):
        st.session_state.jd_list[i] = st.text_area(f"Job Description {i+1}", value=jd, height=150, key=f"jd_{i}")

    st.button("➕ Add Another Job", on_click=add_jd)
    
    st.divider()
    if st.button("🚀 Start Parallel Refine", type="primary", disabled=not uploaded_file or not any(st.session_state.jd_list)):
        st.session_state.processing = True
        st.session_state.jobs = []

# Main Area: Processing and Results
if st.session_state.processing:
    # Save uploaded file to temp
    temp_resume = Path("uploads") / "current_resume.docx"
    temp_resume.parent.mkdir(exist_ok=True)
    with open(temp_resume, "wb") as f:
        f.write(uploaded_file.getbuffer())

    valid_jds = [jd for jd in st.session_state.jd_list if jd.strip()]
    
    progress_bar = st.progress(0)
    status_text = st.empty()
    
    completed_jobs = []
    
    with ThreadPoolExecutor() as executor:
        futures = {executor.submit(process_resume_for_job, temp_resume, jd): jd for jd in valid_jds}
        
        for i, future in enumerate(futures):
            status_text.text(f"Processing job {i+1} of {len(valid_jds)}...")
            try:
                result = future.result()
                completed_jobs.append(result)
            except Exception as e:
                st.error(f"Error processing a job: {e}")
            progress_bar.progress((i + 1) / len(valid_jds))

    st.session_state.jobs = completed_jobs
    st.session_state.processing = False
    status_text.success(f"Finished processing {len(completed_jobs)} jobs!")

# Show Results
if st.session_state.jobs:
    st.header("📋 Results")
    
    # Grid of results
    for job in st.session_state.jobs:
        with st.expander(f"🏢 {job['company']} - 💼 {job['role']}", expanded=True):
            col1, col2 = st.columns([1, 1])
            
            with col1:
                st.write("**Outputs Generated:**")
                
                # DOCX Download
                with open(job['docx'], "rb") as f:
                    st.download_button(
                        label="📥 Download DOCX",
                        data=f,
                        file_name=os.path.basename(job['docx']),
                        mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        key=f"docx_{job['folder']}"
                    )
                
                # PDF Download
                with open(job['pdf'], "rb") as f:
                    st.download_button(
                        label="📥 Download PDF",
                        data=f,
                        file_name=os.path.basename(job['pdf']),
                        mime="application/pdf",
                        key=f"pdf_{job['folder']}"
                    )

            with col2:
                # PDF Preview (Iframe)
                with open(job['pdf'], "rb") as f:
                    base64_pdf = base64.b64encode(f.read()).decode('utf-8')
                    pdf_display = f'<iframe src="data:application/pdf;base64,{base64_pdf}" width="100%" height="500" type="application/pdf"></iframe>'
                    st.markdown(pdf_display, unsafe_allow_html=True)
else:
    if not st.session_state.processing:
        st.info("Upload a resume and add job descriptions in the sidebar to get started.")
