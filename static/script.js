let currentAnalysis = null;
let loadingModal = null;

document.addEventListener('DOMContentLoaded', function() {
    loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
    initializeEventListeners();
});

function initializeEventListeners() {
    const fileInput = document.getElementById('resume-file');
    const uploadArea = document.getElementById('upload-area');
    const fetchJobsBtn = document.getElementById('fetch-jobs-btn');
    const askQuestionBtn = document.getElementById('ask-question-btn');
    const questionInput = document.getElementById('question-input');

    // File upload handling
    fileInput.addEventListener('change', handleFileUpload);
    
    // Drag and drop functionality
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    uploadArea.addEventListener('click', () => fileInput.click());

    // Job recommendations
    fetchJobsBtn.addEventListener('click', fetchJobRecommendations);

    // Q&A functionality
    askQuestionBtn.addEventListener('click', askQuestion);
    questionInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            askQuestion();
        }
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileUpload({target: {files: files}});
    }
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        alert('Please upload a PDF file only.');
        return;
    }

    showLoading('Analyzing your resume...');

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload-resume', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            currentAnalysis = result.analysis;
            displayResults(result.analysis);
            document.getElementById('results-section').style.display = 'block';
            showSuccess(`Resume "${file.name}" analyzed successfully!`);
        } else {
            throw new Error(result.detail || 'Upload failed');
        }
    } catch (error) {
        showError('Error uploading resume: ' + error.message);
    } finally {
        hideLoading();
    }
}

function displayResults(analysis) {
    // Display summary
    document.getElementById('summary-content').innerHTML = formatAnalysisText(analysis.summary);
    
    // Display skill gaps
    document.getElementById('gaps-content').innerHTML = formatAnalysisText(analysis.skill_gaps);
    
    // Display career roadmap
    document.getElementById('roadmap-content').innerHTML = formatAnalysisText(analysis.career_roadmap);
    
    // Store keywords for job search
    document.getElementById('fetch-jobs-btn').dataset.keywords = analysis.job_keywords;
}

function formatAnalysisText(text) {
    // Convert markdown-like formatting to HTML
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^- (.*$)/gm, '<li>$1</li>')
        .replace(/^(\d+\. )(.*$)/gm, '<li>$2</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
}

async function fetchJobRecommendations() {
    if (!currentAnalysis) {
        showError('Please upload and analyze a resume first.');
        return;
    }

    const keywords = document.getElementById('fetch-jobs-btn').dataset.keywords;
    showLoading('Fetching job recommendations...');

    try {
        const response = await fetch('/get-job-recommendations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({keywords: keywords})
        });

        const result = await response.json();

        if (response.ok) {
            displayJobRecommendations(result);
        } else {
            throw new Error(result.detail || 'Failed to fetch jobs');
        }
    } catch (error) {
        showError('Error fetching jobs: ' + error.message);
    } finally {
        hideLoading();
    }
}

function displayJobRecommendations(data) {
    const jobsContent = document.getElementById('jobs-content');
    
    if (!data.linkedin_jobs || data.linkedin_jobs.length === 0) {
        jobsContent.innerHTML = '<div class="alert alert-warning">No jobs found. Try adjusting your resume or skills.</div>';
        return;
    }

    let html = `
        <div class="alert alert-info">
            <i class="fas fa-info-circle me-2"></i>
            Found <strong>${data.total_found}</strong> jobs matching your profile. 
            Showing top ${data.linkedin_jobs.length} results.
        </div>
    `;

    data.linkedin_jobs.forEach(job => {
        html += `
            <div class="card job-card">
                <div class="card-body">
                    <h6 class="job-title">${job.title || 'N/A'}</h6>
                    <div class="job-company">${job.companyName || 'N/A'}</div>
                    <div class="job-location">
                        <i class="fas fa-map-marker-alt me-1"></i>
                        ${job.location || 'N/A'}
                    </div>
                    <div class="mt-2">
                        <a href="${job.link}" target="_blank" class="btn btn-outline-primary btn-sm">
                            <i class="fas fa-external-link-alt me-1"></i>
                            View Job
                        </a>
                    </div>
                </div>
            </div>
        `;
    });

    jobsContent.innerHTML = html;
}

async function askQuestion() {
    const question = document.getElementById('question-input').value.trim();
    if (!question) return;

    if (!currentAnalysis) {
        showError('Please upload and analyze a resume first.');
        return;
    }

    showLoading('Processing your question...');

    try {
        const response = await fetch('/ask-question', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({question: question})
        });

        const result = await response.json();

        if (response.ok) {
            displayQAResult(result);
            document.getElementById('question-input').value = '';
        } else {
            throw new Error(result.detail || 'Failed to process question');
        }
    } catch (error) {
        showError('Error processing question: ' + error.message);
    } finally {
        hideLoading();
    }
}

function displayQAResult(result) {
    console.log('Attempting to display Q&A result...'); // Debug log
    
    // Ensure we're on the Q&A tab first
    const qaTab = document.getElementById('qa-tab');
    const qaTabPane = document.getElementById('qa');
    
    if (qaTab && !qaTab.classList.contains('active')) {
        console.log('Switching to Q&A tab...'); // Debug log
        qaTab.click(); // Use click instead of bootstrap Tab API
    }
    
    // Wait longer for tab to be fully rendered
    setTimeout(() => {
        const qaContent = document.getElementById('qa-content');
        console.log('qaContent element:', qaContent); // Debug log
        
        if (!qaContent) {
            // Try alternative selectors
            const qaHistory = document.querySelector('.qa-history');
            const qaCardBody = document.querySelector('#qa .card-body');
            
            console.log('Alternative elements:', {qaHistory, qaCardBody}); // Debug log
            
            if (qaHistory) {
                // Use qa-history container instead
                displayQAInContainer(qaHistory, result);
                return;
            }
            
            showError('Could not find Q&A container. Please refresh and try again.');
            return;
        }
        
        // Hide placeholder if it exists
        const placeholder = document.getElementById('qa-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        
        // Format the answer text from Markdown to HTML
        const formattedAnswer = formatMarkdownToHTML(result.answer);
        
        const qaHtml = `
            <div class="qa-message qa-question">
                <i class="fas fa-user-circle me-2"></i>
                <strong>Q:</strong> ${result.question}
            </div>
            <div class="qa-message qa-answer">
                <i class="fas fa-robot me-2"></i>
                <strong>A:</strong> ${formattedAnswer}
            </div>
        `;
        
        qaContent.innerHTML = qaHtml + qaContent.innerHTML;
        
    }, 500); // Increased timeout
}

// Helper function to display in any container
function displayQAInContainer(container, result) {
    const placeholder = container.querySelector('#qa-placeholder');
    if (placeholder) {
        placeholder.style.display = 'none';
    }
    
    const formattedAnswer = formatMarkdownToHTML(result.answer);
    
    const qaHtml = `
        <div class="qa-message qa-question">
            <i class="fas fa-user-circle me-2"></i>
            <strong>Q:</strong> ${result.question}
        </div>
        <div class="qa-message qa-answer">
            <i class="fas fa-robot me-2"></i>
            <strong>A:</strong> ${formattedAnswer}
        </div>
    `;
    
    container.innerHTML = qaHtml + container.innerHTML;
}

// Function to convert Markdown-like text to HTML
function formatMarkdownToHTML(text) {
    return text
        // Convert **bold** to <strong>
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Convert * bullet points to <li>
        .replace(/^\* (.+)$/gm, '<li>$1</li>')
        // Wrap consecutive <li> items in <ul>
        .replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/gs, '<ul>$1</ul>')
        // Convert [text](url) links to clickable links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="answer-link">$1 <i class="fas fa-external-link-alt ms-1"></i></a>')
        // Convert email links
        .replace(/mailto:([^\s)]+)/g, 'mailto:$1')
        // Convert line breaks
        .replace(/\n/g, '<br>')
        // Clean up multiple <br> tags
        .replace(/<br>\s*<br>/g, '<br><br>');
}


function showLoading(message) {
    document.getElementById('loading-text').textContent = message;
    loadingModal.show();
}

function hideLoading() {
    loadingModal.hide();
}

function showSuccess(message) {
    showToast(message, 'success');
}

function showError(message) {
    showToast(message, 'danger');
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    toast.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}


