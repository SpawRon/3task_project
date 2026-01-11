document.addEventListener('DOMContentLoaded', () => {
    const imgEl = document.getElementById('image');
    const container = document.getElementById('imageContainer');

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('projectId');
    const imageId = params.get('imageId');

    let currentAnnotations = [];
    let startX, startY, isDrawing = false, tempBox;

    async function init() {
        const imgRes = await fetch(`/projects/${projectId}/images`);
        const images = await imgRes.json();
        const currentImg = images.find(i => i.id == imageId);
        if (!currentImg) return alert("Ошибка: картинка не найдена");
        
        imgEl.src = currentImg.url;

        const annRes = await fetch(`/images/${imageId}/annotations`);
        currentAnnotations = await annRes.json();

        imgEl.onload = () => renderBoxes();
    }
    function renderBoxes() {
        container.querySelectorAll('.bbox').forEach(el => el.remove());

        currentAnnotations.forEach((box, index) => {
            const div = document.createElement('div');
            div.classList.add('bbox');
            
            div.style.left = (box.x * 100) + '%';
            div.style.top = (box.y * 100) + '%';
            div.style.width = (box.width * 100) + '%';
            div.style.height = (box.height * 100) + '%';
            
            //  название и скругленные координаты
            const coordText = `x:${box.x.toFixed(2)} y:${box.y.toFixed(2)}`;
            div.dataset.info = `${box.label} (${coordText})`;

            div.onclick = (e) => {
                e.stopPropagation();
                
                if (confirm(`Удалить область "${box.label}"?`)) {
                    currentAnnotations.splice(index, 1);
                } else {
                    // возможность переименовать
                    const newLabel = prompt('Новое название класса:', box.label);
                    if (newLabel !== null && newLabel.trim() !== "") {
                        box.label = newLabel;
                    } else {
                        return; //отмена в prompt, ничего не сохраняем
                    }
                }
                saveData();
            };
            container.appendChild(div);
        });
    }
    async function saveData() {
        renderBoxes();
        await fetch(`/images/${imageId}/annotations`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(currentAnnotations)
        });
    }

    container.onmousedown = (e) => {
        if (e.button !== 0) return;
        const rect = imgEl.getBoundingClientRect();
        startX = (e.clientX - rect.left) / rect.width;
        startY = (e.clientY - rect.top) / rect.height;
        isDrawing = true;

        tempBox = document.createElement('div');
        tempBox.classList.add('bbox');
        container.appendChild(tempBox);
    };
    window.onmousemove = (e) => {
        if (!isDrawing) return;
        const rect = imgEl.getBoundingClientRect();
        const nowX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const nowY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        const left = Math.min(startX, nowX);
        const top = Math.min(startY, nowY);
        const w = Math.abs(nowX - startX);
        const h = Math.abs(nowY - startY);

        tempBox.style.left = (left * 100) + '%';
        tempBox.style.top = (top * 100) + '%';
        tempBox.style.width = (w * 100) + '%';
        tempBox.style.height = (h * 100) + '%';
    };

    window.onmouseup = () => {
        if (!isDrawing) return;
        isDrawing = false;
        const w = parseFloat(tempBox.style.width) / 100;
        const h = parseFloat(tempBox.style.height) / 100;
        const x = parseFloat(tempBox.style.left) / 100;
        const y = parseFloat(tempBox.style.top) / 100;
        tempBox.remove();
        // ложный клик
        if (w > 0.01 && h > 0.01) {
            const label = prompt('Введите класс:');
            if (label && label.trim() !== "") {
                currentAnnotations.push({
                    label: label.trim(),
                    x: x,
                    y: y,
                    width: w,
                    height: h
                });
                saveData();
            }
        }
    };

    init();
});