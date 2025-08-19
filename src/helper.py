import fitz  # PyMuPDF
import os
from dotenv import load_dotenv
from groq import Groq
import textwrap
from io import BytesIO
# Load environment variables
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Initialize Groq client
client = Groq(api_key=GROQ_API_KEY)

# -------------------------------
# PDF Text Extraction
# -------------------------------

# def extract_text_from_pdf(uploaded_file):
#     """
#     Extracts text from a PDF file (all pages).
#     Returns the combined text.
#     """
#     uploaded_file.seek(0)  # Reset file pointer to the beginning
#     doc = fitz.open(stream=uploaded_file, filetype="pdf")  # Pass the file object, not bytes
#     text = ""
#     for page_num, page in enumerate(doc, start=1):
#         page_text = page.get_text("text")
#         text += f"\n--- Page {page_num} ---\n" + page_text
#     return text.strip()

def extract_text_from_pdf(uploaded_file_bytes):
    """
    Extracts text from a PDF bytes stream (all pages).
    Returns the combined text.
    """
    doc = fitz.open(stream=BytesIO(uploaded_file_bytes), filetype="pdf")
    text = ""
    for page_num, page in enumerate(doc, start=1):
        page_text = page.get_text("text")
        text += f"\n--- Page {page_num} ---\n" + page_text
    return text.strip()


# -------------------------------
# Text Chunking (for large PDFs)
# -------------------------------
def chunk_text(text, max_chars=4000):
    """
    Splits text into chunks so it can fit within Groq token limits.
    """
    return textwrap.wrap(text, max_chars, break_long_words=False, replace_whitespace=False)


# -------------------------------
# Ask Groq LLM
# -------------------------------
def ask_groq(prompt, max_tokens=500, stream=False):
    """
    Send a prompt to Groq LLaMA 3 model and get response.
    """
    try:
        if stream:
            response = client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5,
                max_tokens=max_tokens,
                stream=True
            )
            final_text = ""
            for chunk in response:
                delta = chunk.choices[0].delta.content or ""
                print(delta, end="", flush=True)  # Stream output to console
                final_text += delta
            print()  # Newline after stream ends
            return final_text
        else:
            response = client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5,
                max_tokens=max_tokens
            )
            return response.choices[0].message.content
    except Exception as e:
        return f"⚠️ Error: {str(e)}"


# -------------------------------
# Advanced PDF Q&A
# -------------------------------
def pdf_qa(uploaded_file, question, summarize_first=True):
    """
    Extracts PDF, optionally summarizes it, then answers user question.
    """
    pdf_text = extract_text_from_pdf(uploaded_file)

    # Summarize large text first (optional)
    if summarize_first and len(pdf_text) > 8000:
        chunks = chunk_text(pdf_text, 4000)
        summaries = []
        for idx, chunk in enumerate(chunks, start=1):
            summary = ask_groq(f"Summarize this part of the document (part {idx}):\n{chunk}")
            summaries.append(summary)
        pdf_text = "\n".join(summaries)

    # Now answer the question
    prompt = f"""
You are a helpful assistant.
Here is the extracted text from a PDF document:

{pdf_text[:7000]}   # safe truncation

Now, answer the following question based on the document:
{question}
"""
    return ask_groq(prompt, max_tokens=600)

