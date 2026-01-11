document.addEventListener('DOMContentLoaded', () => {
    const projectNameInput = document.getElementById('projectName');
    const createProjectBtn = document.getElementById('createProject');
    const projectListEl = document.getElementById('projectList');
    const imagesSection = document.getElementById('imagesSection');
    const imagesContainer = document.getElementById('imagesContainer');
    const currentProjectTitle = document.getElementById('currentProjectTitle');
    const backToProjectsBtn = document.getElementById('backToProjects');
    const uploadArea = document.getElementById('uploadArea');
    const imageInput = document.getElementById('imageInput');

    let currentProjectId = null;

    async function renderProjects() {
        const res = await fetch('/projects');
        const projects = await res.json();
        projectListEl.innerHTML = '';
        
        projects.forEach(proj => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${proj.name}</span> 
                <button class="delete-project" onclick="event.stopPropagation(); deleteProject(${proj.id})">❌</button>
            `;
            li.onclick = () => openProject(proj.id, proj.name);
            projectListEl.appendChild(li);
        });
    }
    async function createProject() {
        const name = projectNameInput.value.trim();
        if (!name) return;

        const res = await fetch('/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });

        if (res.ok) {
            projectNameInput.value = '';
            renderProjects();
        } else {
            const err = await res.json();
            alert(err.detail || "Ошибка при создании проекта");
        }
    }
    window.deleteProject = async function(id) {
        if (!confirm("Удалить проект и все изображения в нем?")) return;
        
        const res = await fetch(`/projects/${id}`, { method: 'DELETE' });
        if (res.ok) {
            if (currentProjectId == id) backToProjects();
            else renderProjects();
        }
    };

    function openProject(id, name) {
        currentProjectId = id;
        currentProjectTitle.textContent = `Проект: ${name}`;
        imagesSection.classList.remove('hidden');
        document.querySelector('.projects').classList.add('hidden');
        renderImages();
    }

    function backToProjects() {
        currentProjectId = null;
        imagesSection.classList.add('hidden');
        document.querySelector('.projects').classList.remove('hidden');
        renderProjects();
    }

    async function renderImages() {
        if (!currentProjectId) return;
        const res = await fetch(`/projects/${currentProjectId}/images`);
        const images = await res.json();
        imagesContainer.innerHTML = '';
        images.forEach(img => {
            const div = document.createElement('div');
            div.className = 'image-card';
            div.innerHTML = `
                <img src="${img.url}" onclick="location.href='annotate.html?projectId=${currentProjectId}&imageId=${img.id}'">
                <button class="delete-image" onclick="deleteImage(${img.id})">Удалить</button>
            `;
            imagesContainer.appendChild(div);
        });
    }
    window.deleteImage = async function(imageId) {
        const res = await fetch(`/images/${imageId}`, { method: 'DELETE' });
        if (res.ok) {
            renderImages();
        }
    };

    // drag drop
    async function handleFiles(files) {
        const formData = new FormData();
        for (let file of files) {
            formData.append('files', file);
        }
        const res = await fetch(`/projects/${currentProjectId}/images`, {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            renderImages();
        } else {
            alert("Ошибка при загрузке");
        }
    }

    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
    uploadArea.addEventListener('dragleave', () => { uploadArea.classList.remove('dragover'); });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    imageInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        imageInput.value = '';
    });

    createProjectBtn.addEventListener('click', createProject);
    backToProjectsBtn.addEventListener('click', backToProjects);

    renderProjects();
});