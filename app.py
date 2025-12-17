import streamlit as st
import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import base64
import queue
import time

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

    st.header("📋 Job Progress")

    # Prepare per-job UI elements
    job_views = []
    for idx, jd in enumerate(valid_jds):
        job_container = st.container()
        with job_container:
            st.subheader(f"Job {idx + 1}")
            progress_bar = st.progress(0)
            log_box = st.empty()
            downloads_box = st.empty()
        job_views.append(
            {
                "progress": progress_bar,
                "log_box": log_box,
                "downloads_box": downloads_box,
                "logs": [],
            }
        )

    event_queue: queue.Queue = queue.Queue()

    def make_callback(job_idx: int):
        def callback(message: str, progress: float, elapsed: float) -> None:
            event_queue.put((job_idx, message, progress, elapsed))

        return callback

    futures = {}
    results = [None] * len(valid_jds)

    with ThreadPoolExecutor() as executor:
        for idx, jd in enumerate(valid_jds):
            cb = make_callback(idx)
            futures[idx] = executor.submit(
                process_resume_for_job,
                temp_resume,
                jd,
                status_callback=cb,
            )

        pending = set(futures.keys())

        while pending:
            try:
                job_idx, message, progress_value, elapsed = event_queue.get(
                    timeout=0.1
                )
                view = job_views[job_idx]
                view["progress"].progress(min(max(progress_value, 0.0), 1.0))
                view["logs"].append(f"[{elapsed:5.2f}s] {message}")
                view["log_box"].markdown(
                    "```\n" + "\n".join(view["logs"]) + "\n```"
                )
            except queue.Empty:
                pass

            finished = [i for i in list(pending) if futures[i].done()]
            for i in finished:
                try:
                    result = futures[i].result()
                    results[i] = result
                    job_views[i]["progress"].progress(1.0)
                    job_views[i]["logs"].append("[done] Completed.")
                except Exception as e:
                    job_views[i]["logs"].append(f"[error] {e}")
                job_views[i]["log_box"].markdown(
                    "```\n" + "\n".join(job_views[i]["logs"]) + "\n```"
                )

                # If successful, show downloads + preview inside the card
                if results[i]:
                    job = results[i]
                    with job_views[i]["downloads_box"]:
                        col1, col2 = st.columns([1, 1])
                        with col1:
                            st.write("**Outputs Generated:**")
                            with open(job["docx"], "rb") as f:
                                st.download_button(
                                    label="📥 Download DOCX",
                                    data=f,
                                    file_name=os.path.basename(job["docx"]),
                                    mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                    key=f"docx_{job['folder']}",
                                )
                            with open(job["pdf"], "rb") as f:
                                st.download_button(
                                    label="📥 Download PDF",
                                    data=f,
                                    file_name=os.path.basename(job["pdf"]),
                                    mime="application/pdf",
                                    key=f"pdf_{job['folder']}",
                                )
                        with col2:
                            with open(job["pdf"], "rb") as f:
                                base64_pdf = base64.b64encode(f.read()).decode(
                                    "utf-8"
                                )
                                pdf_display = f'<iframe src="data:application/pdf;base64,{base64_pdf}" width="100%" height="500" type="application/pdf"></iframe>'
                                st.markdown(pdf_display, unsafe_allow_html=True)

                pending.remove(i)

    st.session_state.jobs = [r for r in results if r]
    st.session_state.processing = False
    if st.session_state.jobs:
        st.success(f"Finished processing {len(st.session_state.jobs)} jobs!")
    else:
        st.error("No jobs completed successfully.")

# When idle
if not st.session_state.processing and not st.session_state.jobs:
    st.info("Upload a resume and add job descriptions in the sidebar to get started.")
