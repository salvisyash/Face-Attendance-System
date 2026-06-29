// Global State Management
const STATE = {
    currentView: 'landing-view',
    isAdminLoggedIn: false,
    activeStream: null,
    attendanceLogs: [],
    scanInterval: null,
    isScanning: false,
    activeScannerMode: 'webcam' // 'webcam' or 'upload'
};

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    // initDatabase();
    setupNavigation();
    setupForms();
    setupWebcamHandlers();
    setupDragAndDrop();
    // updateDashboardStats();
    loadAttendanceLogs();
    renderAttendanceTable();
    renderStudentDropdown();

    // Default to Landing view
    navigateTo('landing-view');
});

// // --- local DATABASE LOGIC ---
// function initDatabase() {
//     // Enrolled Students Setup
//     if (!localStorage.getItem('face_attendance_students')) {
//         localStorage.setItem('face_attendance_students', JSON.stringify([]));
//     }

//     // Attendance Logs Setup
//     if (!localStorage.getItem('face_attendance_logs')) {
//         localStorage.setItem('face_attendance_logs', JSON.stringify([]));
//     }
//     STATE.attendanceLogs = JSON.parse(localStorage.getItem('face_attendance_logs'));
// }

function saveStudents() {
    renderStudentDropdown();
}

function saveLogs() {
    // localStorage.setItem('face_attendance_logs', JSON.stringify(STATE.attendanceLogs));
    // updateDashboardStats();
    renderAttendanceTable();
}

// --- NAVIGATION SYSTEM ---
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link-trigger');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetView = link.getAttribute('data-view');

            // Check authorization for admin view
            if (targetView === 'admin-view' && !STATE.isAdminLoggedIn) {
                showToast('Authorization Required', 'Please login to access the admin panel.', 'error');
                navigateTo('login-view');
                return;
            }

            navigateTo(targetView);
        });
    });

    // Quick Action Landing Buttons
    document.getElementById('hero-enroll-btn').addEventListener('click', () => navigateTo('enroll-view'));
    document.getElementById('hero-admin-btn').addEventListener('click', () => {
        if (STATE.isAdminLoggedIn) {
            navigateTo('admin-view');
        } else {
            navigateTo('login-view');
        }
    });

    // Logout Action
    document.getElementById('admin-logout-btn').addEventListener('click', () => {
        STATE.isAdminLoggedIn = false;
        showToast('Logged Out', 'You have successfully signed out.', 'info');
        // Update nav status
        document.querySelectorAll('.admin-only-btn').forEach(btn => btn.style.display = 'none');
        navigateTo('landing-view');
    });
}

function navigateTo(viewId) {
    // Stop camera and intervals from previous page
    stopActiveCamera();
    stopActiveScanning();

    // Toggle active view screen
    const screens = document.querySelectorAll('.view-screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
    });

    const activeScreen = document.getElementById(viewId);
    if (activeScreen) {
        activeScreen.classList.add('active');
        STATE.currentView = viewId;
    }

    // Toggle active link states
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-view') === viewId) {
            btn.classList.add('active');
        }
    });

    // Special View Intialization
    if (viewId === 'enroll-view') {
        initEnrollCamera();
    } else if (viewId === 'admin-view') {
        initAdminAttendanceView();
    }
}

// --- MOCK NOTIFICATION SYSTEM ---
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ri-information-line';
    if (type === 'success') icon = 'ri-checkbox-circle-line';
    if (type === 'error') icon = 'ri-error-warning-line';

    toast.innerHTML = `
        <i class="${icon}"></i>
        <div>
            <h5 style="font-weight:600; font-size: 0.9rem;">${title}</h5>
            <p style="font-size: 0.8rem; color: var(--text-secondary);">${message}</p>
        </div>
    `;

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- STUDENT ENROLLMENT INTERACTION ---
function initEnrollCamera() {
    const video = document.getElementById('enroll-video');
    const canvas = document.getElementById('enroll-canvas');
    const simulatedFeed = document.getElementById('enroll-simulated-feed');

    startWebcam(video, canvas, simulatedFeed, (streamActive) => {
        if (streamActive) {
            // Draw a guide circle on the canvas for user face alignment
            drawEnrollViewfinderGuide(canvas);
        }
    });
}

function drawEnrollViewfinderGuide(canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    function drawLoop() {
        if (STATE.currentView !== 'enroll-view') return;
        ctx.clearRect(0, 0, width, height);

        // Draw overlay shadow surrounding center face zone
        ctx.fillStyle = 'rgba(10, 15, 29, 0.6)';
        ctx.fillRect(0, 0, width, height);

        // Define a path for circular mask
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(width / 2, height / 2 - 10, 100, 0, Math.PI * 2);
        ctx.fill();

        // Restore normal draw mode
        ctx.globalCompositeOperation = 'source-over';

        // Draw beautiful scanning guides
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2 - 10, 100, 0, Math.PI * 2);
        ctx.stroke();

        // Target ticks
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.8)';
        ctx.lineWidth = 4;
        const centerX = width / 2;
        const centerY = height / 2 - 10;
        const r = 100;

        // Draw brackets at 4 corners
        ctx.beginPath();
        // Top Left
        ctx.arc(centerX, centerY, r, Math.PI * 1.15, Math.PI * 1.35);
        ctx.stroke();

        ctx.beginPath();
        // Top Right
        ctx.arc(centerX, centerY, r, Math.PI * 1.65, Math.PI * 1.85);
        ctx.stroke();

        ctx.beginPath();
        // Bottom Left
        ctx.arc(centerX, centerY, r, Math.PI * 0.65, Math.PI * 0.85);
        ctx.stroke();

        ctx.beginPath();
        // Bottom Right
        ctx.arc(centerX, centerY, r, Math.PI * 0.15, Math.PI * 0.35);
        ctx.stroke();

        requestAnimationFrame(drawLoop);
    }
    drawLoop();
}

function setupForms() {
    // Admin Login Submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('login-username').value.trim();
            const passwordInput = document.getElementById('login-password').value.trim();

            try {
                const response = await fetch('/api/adminlogin', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: usernameInput,
                        password: passwordInput
                    })
                });

                const data = await response.json();

                if (data.success) {
                    STATE.isAdminLoggedIn = true;

                    showToast(
                        'Welcome, Administrator',
                        'Login successful.',
                        'success'
                    );

                    document
                        .querySelectorAll('.admin-only-btn')
                        .forEach(btn => btn.style.display = 'flex');

                    loginForm.reset();

                    navigateTo('admin-view');
                } else {
                    showToast(
                        'Authentication Failed',
                        data.message,
                        'error'
                    );
                }

            } catch (error) {
                console.error(error);

                showToast(
                    'Server Error',
                    'Unable to connect to server',
                    'error'
                );
            }
        });
    }

    // Student Enrollment Submission
    const enrollForm = document.getElementById('enroll-form');
    if (enrollForm) {
        enrollForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('enroll-name').value.trim();
            const rollNo = document.getElementById('enroll-roll').value.trim();
            const dept = document.getElementById('enroll-dept').value;

            if (!name || !rollNo || !dept) {
                showToast('Form Error', 'Please fill all required inputs.', 'error');
                return;
            }

            // Capture face scanning visualization
            const cameraContainer = document.querySelector('#enroll-view .viewfinder-card');
            cameraContainer.classList.add('scanning');
            showToast('Biometric Analysis', 'Registering face patterns... Please hold still.', 'info');

            const video = document.getElementById('enroll-video');
            const canvas = document.getElementById('enroll-canvas');
            const ctx = canvas.getContext("2d");

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            let frames = [];

            setTimeout(() => {
                showToast("Camera", "Capturing face images...", "info");
            }, 2000);

            for (let i = 0; i < 10; i++) {
                ctx.drawImage(
                    video,
                    0,
                    0
                );
                console.log(canvas);
                const base64 = canvas.toDataURL("image/jpeg", 0.9);
                console.log(base64.substring(0, 50));
                frames.push(base64);
                await new Promise(r => setTimeout(r, 300));
            }

            const response = await fetch("/api/enrollFace", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: name,
                    rollNo: rollNo,
                    department: dept,
                    images: frames

                })

            });

            const result = await response.json();
            if (result.status == 'Success') {
                cameraContainer.classList.remove('scanning');
                showToast('Enrollment Complete', `${result.name} successfully registered in system view.`, 'success');
                enrollForm.reset();
            } else {
                cameraContainer.classList.remove('scanning');
                showToast('Enrollment Error', `${result.error}`, 'error');
                enrollForm.reset();
            }

            // setTimeout(() => {
            //     cameraContainer.classList.remove('scanning');
            //     showToast('Enrollment Complete', `${name} successfully registered in system view.`, 'success');
            //     enrollForm.reset();
            // }, 2000);
        });
    }

    // Table Search Filter
    const searchInput = document.getElementById('log-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#attendance-table-body tr');

            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                if (text.includes(query)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }

    // Export Logs
    const exportBtn = document.getElementById('export-logs-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (STATE.attendanceLogs.length === 0) {
                showToast('Export Error', 'There are no attendance records to export.', 'warning');
                return;
            }

            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Student Name,Roll Number,Department,Date,Time,Status\n";

            STATE.attendanceLogs.forEach(log => {
                const row = `"${log.name}","${log.id}","${log.department}","${log.date}","${log.time}","${log.status}"`;
                csvContent += row + "\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `face_attendance_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link); // Required for FF
            link.click();
            document.body.removeChild(link);

            showToast('Export Success', 'CSV spreadsheet exported successfully.', 'success');
        });
    }

    // Clear Logs
    const clearLogsBtn = document.getElementById('clear-logs-btn');
    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to clear all attendance logs for this session?")) {
                STATE.attendanceLogs = [];
                saveLogs();

                // Clear live feed list
                const list = document.getElementById('live-stream-records');
                if (list) {
                    list.innerHTML = `
                        <div class="empty-state">
                            <i class="ri-radar-line"></i>
                            <p>Waiting for scanner feed...</p>
                        </div>
                    `;
                }

                showToast('Database Reset', 'Attendance table cleared.', 'success');
            }
        });
    }

    // Manual Attendance Marker Trigger Form
    const manualMarkForm = document.getElementById('manual-mark-form');
    if (manualMarkForm) {
        manualMarkForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const studentId = document.getElementById('mark-student-select').value;
            const status = document.getElementById('mark-status').value;

            if (!student) {
                showToast('Form Error', 'Please select a valid student.', 'error');
                return;
            }

            // Mark attendance
            const today = new Date().toLocaleDateString();
            const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Check duplicate
            const existsIndex = STATE.attendanceLogs.findIndex(
                log => log.id === student.id && log.date === today
            );

            if (existsIndex > -1) {
                // Update status
                STATE.attendanceLogs[existsIndex].status = status;
                STATE.attendanceLogs[existsIndex].time = nowTime;
                showToast('Status Updated', `Updated status for ${student.name} to ${status}`, 'success');
            } else {
                const newLog = {
                    id: student.id,
                    name: student.name,
                    department: student.department,
                    time: nowTime,
                    date: today,
                    status: status,
                    photoUrl: student.photoUrl
                };
                STATE.attendanceLogs.unshift(newLog);
                showToast('Attendance Logged', `Marked ${student.name} as ${status}`, 'success');
            }

            saveLogs();
            manualMarkForm.reset();
        });
    }
}

// --- WEBCAM UTILITIES ---
function startWebcam(videoElement, canvasElement, simulatedFeed, callback) {
    stopActiveCamera(); // Ensure clean start

    // Set canvas dimensions relative to bounding box
    // setTimeout(() => {
    //     canvasElement.width = videoElement.clientWidth || 640;
    //     canvasElement.height = videoElement.clientHeight || 480;
    // }, 100);

    // Constraints
    const constraints = {
        video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user"
        }
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {

            STATE.activeStream = stream;
            videoElement.srcObject = stream;

            videoElement.onloadedmetadata = async () => {

                await videoElement.play();

                // Use actual camera resolution
                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;

                simulatedFeed.style.display = "none";

                console.log("Video Size:",
                    videoElement.videoWidth,
                    videoElement.videoHeight
                );

                if (callback) callback(true);
            };

        })
        .catch(err => {

            console.error(err);

            videoElement.srcObject = null;
            simulatedFeed.style.display = "flex";

            if (callback) callback(false);
        });
}

function stopActiveCamera() {
    if (STATE.activeStream) {
        STATE.activeStream.getTracks().forEach(track => track.stop());
        STATE.activeStream = null;
    }
}

// --- ADMIN ATTENDANCE VIEW CONTROLS ---
function initAdminAttendanceView() {

    loadAttendanceLogs();   // <-- Load from DB
    // Default Tab
    switchAttendanceMode('webcam');

    // Tab switcher events
    document.getElementById('tab-btn-webcam').addEventListener('click', () => switchAttendanceMode('webcam'));
    document.getElementById('tab-btn-upload').addEventListener('click', () => switchAttendanceMode('upload'));

    // Manual Scan Simulators
    document.getElementById('trigger-scan-btn').addEventListener('click', () => {
        triggerSingleWebcamScan();
    });
}

function switchAttendanceMode(mode) {
    STATE.activeScannerMode = mode;
    stopActiveCamera();
    stopActiveScanning();

    // Toggle Tab button styling
    document.querySelectorAll('.control-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-btn-${mode}`).classList.add('active');

    // Toggle Content Panes
    const webcamPane = document.getElementById('attendance-webcam-pane');
    const uploadPane = document.getElementById('attendance-upload-pane');

    if (mode === 'webcam') {
        webcamPane.style.display = 'block';
        uploadPane.style.display = 'none';

        // Start Webcam
        const video = document.getElementById('attendance-video');
        const canvas = document.getElementById('attendance-canvas');
        const simulatedFeed = document.getElementById('attendance-simulated-feed');

        startWebcam(video, canvas, simulatedFeed, (active) => {
            // Draw a bracket outline around face area
            drawAttendanceViewfinderGuide(canvas);

            // Auto start scanner loop disabled as per request
            // startAutoScanningLoop();
        });
    } else {
        webcamPane.style.display = 'none';
        uploadPane.style.display = 'block';

        // Reset file upload zone
        resetUploadPane();
    }
}

function drawAttendanceViewfinderGuide(canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Face detection box coordinates
    let boxX = width / 2 - 80;
    let boxY = height / 2 - 90;
    let boxW = 160;
    let boxH = 180;

    function drawLoop() {
        if (STATE.currentView !== 'admin-view' || STATE.activeScannerMode !== 'webcam') return;
        ctx.clearRect(0, 0, width, height);

        // If scanning is active, draw detection boxes
        if (STATE.isScanning) {
            // Draw green bounding box tracking mock face
            ctx.strokeStyle = '#10b981'; // Success emerald green
            ctx.lineWidth = 2;
            ctx.strokeRect(boxX, boxY, boxW, boxH);

            // Tech brackets
            ctx.fillStyle = '#10b981';
            const bracketSize = 10;
            // TL
            ctx.fillRect(boxX - 2, boxY - 2, bracketSize, 3);
            ctx.fillRect(boxX - 2, boxY - 2, 3, bracketSize);
            // TR
            ctx.fillRect(boxX + boxW - bracketSize + 2, boxY - 2, bracketSize, 3);
            ctx.fillRect(boxX + boxW - 1, boxY - 2, 3, bracketSize);
            // BL
            ctx.fillRect(boxX - 2, boxY + boxH - 1, bracketSize, 3);
            ctx.fillRect(boxX - 2, boxY + boxH - bracketSize + 2, 3, bracketSize);
            // BR
            ctx.fillRect(boxX + boxW - bracketSize + 2, boxY + boxH - 1, bracketSize, 3);
            ctx.fillRect(boxX + boxW - 1, boxY + boxH - bracketSize + 2, 3, bracketSize);

            // Add text overlay
            ctx.font = '600 12px Outfit';
            ctx.fillStyle = '#10b981';
            ctx.fillText("FACE TRACKING OK", boxX, boxY - 8);
        } else {
            // Standard tracking look
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.strokeRect(boxX, boxY, boxW, boxH);

            ctx.font = '600 12px Outfit';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillText("ALIGN FACE HERE", boxX, boxY - 8);
        }

        requestAnimationFrame(drawLoop);
    }
    drawLoop();
}

async function loadAttendanceLogs() {
    try {
        const response = await fetch("/api/attendancelogs");
        const result = await response.json();

        if (result.status === "Success") {

            STATE.attendanceLogs = result.data.map(item => ({
                name: item.name,
                id: item.id,
                department: item.department,
                status: item.status,
                time: item.attendance_time,
                date: new Date(item.attendance_date).toLocaleDateString(),
                photoUrl: item.photoUrl
            }));

            renderAttendanceTable();

        }

    } catch (err) {
        console.error(err);
        showToast("Error", "Unable to load attendance records.", "error");
    }
}

// Auto-scan logic
function startAutoScanningLoop() {
    STATE.scanInterval = setInterval(() => {
        if (!STATE.isScanning) {
            triggerSingleWebcamScan();
        }
    }, 8000); // Try to scan every 8s automatically
}

function stopActiveScanning() {
    if (STATE.scanInterval) {
        clearInterval(STATE.scanInterval);
        STATE.scanInterval = null;
    }
    STATE.isScanning = false;
}

async function triggerSingleWebcamScan() {

    if (STATE.isScanning) return;

    STATE.isScanning = true;

    const cameraCard = document.querySelector(
        '#attendance-webcam-pane .viewfinder-card'
    );

    cameraCard.classList.add("scanning");

    showToast(
        "Biometric Scanner",
        "Scanning face...",
        "info"
    );

    const video = document.getElementById("attendance-video");
    const canvas = document.getElementById("attendance-canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const frames = [];

    for (let i = 0; i < 50; i++) {

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        frames.push(
            canvas.toDataURL("image/jpeg", 0.8)
        );

        await new Promise(resolve => setTimeout(resolve, 80));
    }

    const response = await fetch("/api/attendance", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            images: frames
        })
    });

    const result = await response.json();

    STATE.isScanning = false;
    cameraCard.classList.remove("scanning");

    if (result.status === "Success") {
        showToast(
            "Attendance",
            `${result.student['name']} marked successfully.`,
            "success"
        );

        await loadAttendanceLogs();   // Refresh table
    }
    else {
        showToast(
            "Attendance",
            "Face not recognized.",
            "error"
        );
    }
}

function logAttendance(student) {
    const today = new Date().toLocaleDateString();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Check if already logged today
    const exists = STATE.attendanceLogs.some(
        log => log.id === student.id && log.date === today
    );

    if (exists) {
        showToast('Duplicate Scan', `${student.name} has already logged attendance for today.`, 'info');
        return;
    }

    const newLog = {
        id: student.id,
        name: student.name,
        department: student.department,
        time: nowTime,
        date: today,
        status: "Present",
        photoUrl: student.photoUrl // include avatar if registered
    };

    STATE.attendanceLogs.unshift(newLog); // Add to beginning of array
    saveLogs();

    showToast('Attendance Logged', `${student.name} matches (ID: ${student.id})!`, 'success');

    // Add slide in live notification record
    appendLiveFeedRecord(newLog);
}

function appendLiveFeedRecord(log) {
    const list = document.getElementById('live-stream-records');
    if (!list) return;

    // Check and remove "No active scans" placeholder
    const placeholder = list.querySelector('.empty-state');
    if (placeholder) {
        placeholder.remove();
    }

    const card = document.createElement('div');
    card.className = 'stream-record-card';

    const avatarContent = log.photoUrl
        ? `style="background-image: url(${log.photoUrl})"`
        : '';

    card.innerHTML = `
        <div class="stream-record-details">
            <div class="stream-record-avatar" ${avatarContent}>
                ${log.photoUrl ? '' : '<i class="ri-user-check-line"></i>'}
            </div>
            <div class="stream-record-info">
                <h4>${log.name}</h4>
                <span>ID: ${log.id} • ${log.department}</span>
            </div>
        </div>
        <div class="stream-record-time">
            ${log.time}
        </div>
    `;

    list.insertBefore(card, list.firstChild);

    // Cap at 10 items in live column
    if (list.children.length > 10) {
        list.removeChild(list.lastChild);
    }
}

// --- FILE UPLOAD SCANNER ---
function setupDragAndDrop() {
    const dragZone = document.getElementById('drag-zone');
    const fileInput = document.getElementById('attendance-file-input');

    if (!dragZone) return;

    // Trigger file dialog on click
    dragZone.addEventListener('click', () => fileInput.click());

    // Highlight drop area
    ['dragenter', 'dragover'].forEach(eventName => {
        dragZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dragZone.classList.add('drag-active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dragZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dragZone.classList.remove('drag-active');
        }, false);
    });

    // Handle dropped files
    dragZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) handleImageUpload(files[0]);
    });

    // Handle selected files
    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length) handleImageUpload(files[0]);
    });
}

function resetUploadPane() {
    document.getElementById('drag-zone').style.display = 'flex';
    document.getElementById('upload-preview-container').style.display = 'none';
    const canvas = document.getElementById('upload-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function handleImageUpload(file) {
    // Validate type
    if (!file.type.startsWith('image/')) {
        showToast('File Type Error', 'Please select an image file (PNG/JPG).', 'error');
        return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const dataUrl = reader.result;

        // Hide drop zone and show preview
        document.getElementById('drag-zone').style.display = 'none';

        const previewContainer = document.getElementById('upload-preview-container');
        previewContainer.style.display = 'block';
        previewContainer.classList.add('scanning');

        const previewImg = document.getElementById('upload-preview-img');
        previewImg.src = dataUrl;

        const canvas = document.getElementById('upload-canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas bounds
        previewImg.onload = () => {
            canvas.width = previewImg.clientWidth;
            canvas.height = previewImg.clientHeight;

            showToast('Analyzing Image', 'Locating face coordinates...', 'info');

            // Draw bounding box after a scan delay
            setTimeout(async () => {
                if (STATE.currentView !== 'admin-view' || STATE.activeScannerMode !== 'upload') return;

                ctx.drawImage(previewImg, 0, 0, canvas.width, canvas.height);

                // frames.push(
                //     canvas.toDataURL("image/jpeg", 0.8)
                // );

                const response = await fetch("/api/imageattendance", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        image: canvas.toDataURL("image/jpeg", 0.8)
                    })
                });

                const result = await response.json();

                if (result.status === "Success") {
                    showToast(
                        "Attendance",
                        `${result.student['name']} marked successfully.`,
                        "success"
                    );

                    await loadAttendanceLogs();   // Refresh table
                }
                else {
                    showToast(
                        "Attendance",
                        "Face not recognized.",
                        "error"
                    );
                }
                // setTimeout(() => {
                //     previewContainer.classList.remove('scanning');
                //     showToast('Analysis Complete', 'Face coordinates mapped in image.', 'success');
                // }, 2000);
            }, 2000);
        };
    };
}

// --- WEBCAM HELPERS & SIMULATION ---
function setupWebcamHandlers() {
    // Handle manual simulation toggle when camera permission is unavailable
    document.querySelectorAll('.btn-sim-manual').forEach(btn => {
        btn.addEventListener('click', () => {
            showToast('Scan Simulation', 'Simulating webcam detection frame overlay.', 'success');
            STATE.isScanning = true;
            setTimeout(() => {
                STATE.isScanning = false;
            }, 3000);
        });
    });
}

// --- STATS & LOGS MANAGEMENT ---
// function updateDashboardStats() {

//     // Present students today
//     const today = new Date().toLocaleDateString();
//     const presentTodayCount = STATE.attendanceLogs.filter(
//         log => log.date === today && log.status === 'Present'
//     ).length;

//     // Absent count
//     const absentCount = Math.max(0, totalStudents - presentTodayCount);

//     // Update UI elements
//     const totalEl = document.getElementById('stat-total-students');
//     const presentEl = document.getElementById('stat-present-today');
//     const absentEl = document.getElementById('stat-absent-today');

//     if (totalEl) totalEl.textContent = totalStudents;
//     if (presentEl) presentEl.textContent = presentTodayCount;
//     if (absentEl) absentEl.textContent = absentCount;
// }

function renderAttendanceTable() {
    const tbody = document.getElementById('attendance-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (STATE.attendanceLogs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem 0;">
                    <i class="ri-article-line" style="font-size: 2rem; display:block; margin-bottom: 0.5rem;"></i>
                    No attendance records logged yet
                </td>
            </tr>
        `;
        return;
    }

    STATE.attendanceLogs.forEach(log => {
        const tr = document.createElement('tr');

        const badgeClass = log.status === 'Present' ? 'badge-present' : 'badge-absent';

        tr.innerHTML = `
            <td style="font-weight: 600;">${log.name}</td>
            <td>${log.id}</td>
            <td>${log.department}</td>
            <td>
                <div style="display:flex; flex-direction:column;">
                    <span>${log.time}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${log.date}</span>
                </div>
            </td>
            <td><span class="badge ${badgeClass}">${log.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// Helper function registrations

function renderStudentDropdown() {
    const select = document.getElementById('mark-student-select');
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>Select a student...</option>';

}
