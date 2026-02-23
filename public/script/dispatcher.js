        // Состояние
        let currentUser = null;
        let masters = [];
        let allRequests = [];
        let filteredRequests = [];
        let searchTimeout;

        // Загрузка данных при старте
        document.addEventListener('DOMContentLoaded', function() {
            loadUserInfo();
            loadMasters();
            loadRequests();
        });

        // Загрузка информации о пользователе
        async function loadUserInfo() {
            try {
                const response = await fetch('/api/auth/me');
                if (response.ok) {
                    currentUser = await response.json();
                    document.getElementById('user-name').textContent = currentUser.name || currentUser.role;
                    document.getElementById('user-avatar').textContent = currentUser.role === 'dispatcher' ? '👤' : '🔧';
                } else {
                    window.location.href = '/';
                }
            } catch (error) {
                showMessage('error', 'Ошибка загрузки данных пользователя');
            }
        }

        // Выход
        async function logout() {
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
            } catch (error) {
                console.error('Logout error:', error);
            }
            window.location.href = '/';
        }

        // Загрузка списка мастеров
        async function loadMasters() {
            try {
                const response = await fetch('/api/masters');
                if (response.ok) {
                    masters = await response.json();
                }
            } catch (error) {
                showMessage('error', 'Ошибка загрузки списка мастеров');
            }
        }

        // Загрузка заявок
// Загрузка заявок
async function loadRequests() {
    try {
        // Получаем текущий фильтр по статусу
        const statusFilter = document.getElementById('statusFilter').value;
        let url = '/api/requests';
        
        // Добавляем параметр статуса в URL, если он выбран
        if (statusFilter && statusFilter !== '') {
            url += '?status=' + encodeURIComponent(statusFilter);
        }
        
        console.log('Loading requests from:', url);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        allRequests = await response.json();
        console.log('Loaded requests:', allRequests);
        
        // Применяем локальные фильтры (поиск и показ архивных)
        applyLocalFilters();
        updateStats();
    } catch (error) {
        console.error('Error loading requests:', error);
        showMessage('error', 'Ошибка загрузки заявок');
    }
}

// Применение локальных фильтров (поиск и показ архивных)
function applyLocalFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const showArchive = document.getElementById('showArchive').checked;

    filteredRequests = allRequests.filter(req => {
        // Фильтр по архиву (если чекбокс не отмечен, скрываем удаленные)
        if (!showArchive && req.status === 'deleted') return false;
        
        // Поиск по тексту
        if (searchTerm) {
            const searchable = `${req.clientName} ${req.phone} ${req.address} ${req.problemText}`.toLowerCase();
            if (!searchable.includes(searchTerm)) return false;
        }
        
        return true;
    });

    console.log('Filtered requests:', filteredRequests.length);
    renderRequests(filteredRequests);
}

function applyFilters() {
    // Перезагружаем заявки с сервера с новым статусом
    loadRequests();
}

        // Поиск с debounce
        function debounceSearch() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(applyFilters, 300);
        }

        // Сброс фильтров
        function resetFilters() {
            document.getElementById('statusFilter').value = '';
            document.getElementById('searchInput').value = '';
            document.getElementById('showArchive').checked = false;
            applyFilters();
        }

        // Обновление статистики
        function updateStats() {
            const stats = {
                new: allRequests.filter(r => r.status === 'new').length,
                assigned: allRequests.filter(r => r.status === 'assigned').length,
                in_progress: allRequests.filter(r => r.status === 'in_progress').length,
                done: allRequests.filter(r => r.status === 'done').length,
                canceled: allRequests.filter(r => r.status === 'canceled').length
            };

            document.getElementById('stat-new').textContent = stats.new;
            document.getElementById('stat-assigned').textContent = stats.assigned;
            document.getElementById('stat-progress').textContent = stats.in_progress;
            document.getElementById('stat-done').textContent = stats.done;
            document.getElementById('stat-canceled').textContent = stats.canceled;
        }

        // Отображение заявок
        function renderRequests(requests) {
            const tbody = document.getElementById('requestsBody');
            
            if (!requests || requests.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 50px;">
                            <div style="font-size: 18px; color: #999;">📭 Заявки не найдены</div>
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = requests.map(req => {
                const statusClass = `status-badge status-${req.status}`;
                const statusText = {
                    'new': '🆕 Новая',
                    'assigned': '📌 Назначена',
                    'in_progress': '⚙️ В работе',
                    'done': '✅ Выполнена',
                    'canceled': '❌ Отменена',
                    'deleted': '🗑️ Удалена'
                }[req.status] || req.status;

                const rowClass = req.status === 'deleted' ? 'deleted-row' : '';

                return `
                    <tr class="${rowClass}">
                        <td><strong>#${req.id}</strong></td>
                        <td>${escapeHtml(req.clientName)}</td>
                        <td>${escapeHtml(req.phone)}</td>
                        <td>${escapeHtml(req.address)}</td>
                        <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(req.problemText)}">
                            ${escapeHtml(req.problemText)}
                        </td>
                        <td><span class="${statusClass}">${statusText}</span></td>
                        <td>${req.masterName ? `👤 ${escapeHtml(req.masterName)}` : '—'}</td>
                        <td>${formatDate(req.createdAt)}</td>
                        <td>
                            <div class="table-actions">
                                ${renderActions(req)}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Отображение действий в зависимости от статуса
        function renderActions(req) {
            if (req.status === 'deleted') {
                return `
                    <button class="btn btn-danger btn-sm" onclick="permanentDeleteRequest(${req.id})">
                        <span class="btn-icon">🗑️</span> Удалить навсегда
                    </button>
                `;
            }

            let actions = '';

            if (req.status === 'new') {
                actions += `
                    <select class="master-select" data-id="${req.id}">
                        <option value="">Выберите мастера</option>
                        ${masters.map(m => `<option value="${m.id}">👤 ${escapeHtml(m.full_name)}</option>`).join('')}
                    </select>
                    <button class="btn btn-primary btn-sm" onclick="assignMaster(${req.id})">
                        <span class="btn-icon">✓</span> Назначить
                    </button>
                `;
            }

            if (req.status === 'assigned') {
                actions += `<div class="status-info">⏳ Ожидает мастера</div>`;
            }

            if (req.status !== 'done' && req.status !== 'canceled' && req.status !== 'deleted') {
                actions += `
                    <button class="btn btn-danger btn-sm" onclick="cancelRequest(${req.id})">
                        <span class="btn-icon">✗</span> Отменить
                    </button>
                `;
            }

            if (req.status === 'done') {
                actions += `<span class="status-info completed">✓ Завершена</span>`;
            }

            if (req.status === 'canceled') {
                actions += `<span class="status-info canceled">✗ Отменена</span>`;
            }

            // Кнопка архивации для выполненных и отмененных
            if (req.status === 'done' || req.status === 'canceled') {
                actions += `
                    <button class="btn btn-secondary btn-sm" onclick="archiveRequest(${req.id})">
                        <span class="btn-icon">📦</span> В архив
                    </button>
                `;
            }

            return actions;
        }

        // Назначение мастера
        async function assignMaster(requestId) {
            const select = document.querySelector(`.master-select[data-id="${requestId}"]`);
            if (!select) return;

            const masterId = select.value;
            if (!masterId) {
                showMessage('error', 'Выберите мастера');
                return;
            }

            const button = event.target;
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="loading-spinner"></span> Назначение...';
            button.disabled = true;

            try {
                const response = await fetch(`/api/requests/${requestId}/assign`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ masterId: parseInt(masterId) })
                });

                if (response.ok) {
                    showMessage('success', 'Мастер назначен');
                    await loadRequests();
                } else {
                    const data = await response.json();
                    showMessage('error', data.error || 'Ошибка при назначении');
                }
            } catch (error) {
                showMessage('error', 'Ошибка соединения');
            } finally {
                button.innerHTML = originalText;
                button.disabled = false;
            }
        }

        // Отмена заявки
        async function cancelRequest(requestId) {
            if (!await confirmDialog('отменить заявку')) return;

            const button = event.target;
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="loading-spinner"></span> Отмена...';
            button.disabled = true;

            try {
                const response = await fetch(`/api/requests/${requestId}/cancel`, {
                    method: 'PATCH'
                });

                if (response.ok) {
                    showMessage('success', 'Заявка отменена');
                    await loadRequests();
                } else {
                    const data = await response.json();
                    showMessage('error', data.error || 'Ошибка при отмене');
                }
            } catch (error) {
                showMessage('error', 'Ошибка соединения');
            } finally {
                button.innerHTML = originalText;
                button.disabled = false;
            }
        }

        // Архивация заявки (мягкое удаление)
// Архивация заявки
async function archiveRequest(requestId) {
    if (!await confirmDialog('отправить заявку в архив')) return;

    const button = event.target;
    const originalText = button.innerHTML;
    button.innerHTML = '<span class="loading-spinner"></span> Архивация...';
    button.disabled = true;

    try {
        console.log('Sending archive request for:', requestId);
        
        const response = await fetch(`/api/requests/${requestId}/archive`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        console.log('Archive response:', response.status, data);

        if (response.ok) {
            showMessage('success', '✅ Заявка отправлена в архив');
            await loadRequests(); // Перезагружаем список
        } else {
            showMessage('error', `❌ ${data.error || 'Ошибка при архивации'}`);
        }
    } catch (error) {
        console.error('Archive error:', error);
        showMessage('error', '❌ Ошибка соединения с сервером');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Полное удаление
async function permanentDeleteRequest(requestId) {
    if (!await confirmDialog('полностью удалить заявку', 'danger')) return;

    const button = event.target;
    const originalText = button.innerHTML;
    button.innerHTML = '<span class="loading-spinner"></span> Удаление...';
    button.disabled = true;

    try {
        console.log('Sending permanent delete for:', requestId);
        
        const response = await fetch(`/api/requests/${requestId}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        console.log('Delete response:', response.status, data);

        if (response.ok) {
            showMessage('success', '✅ Заявка удалена навсегда');
            await loadRequests();
        } else {
            showMessage('error', `❌ ${data.error || 'Ошибка при удалении'}`);
        }
    } catch (error) {
        console.error('Delete error:', error);
        showMessage('error', '❌ Ошибка соединения с сервером');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Восстановление из архива
async function restoreRequest(requestId) {
    if (!await confirmDialog('восстановить заявку из архива')) return;

    const button = event.target;
    const originalText = button.innerHTML;
    button.innerHTML = '<span class="loading-spinner"></span> Восстановление...';
    button.disabled = true;

    try {
        const response = await fetch(`/api/requests/${requestId}/restore`, {
            method: 'PATCH'
        });

        if (response.ok) {
            showMessage('success', '✅ Заявка восстановлена из архива');
            await loadRequests();
        } else {
            const data = await response.json();
            showMessage('error', `❌ ${data.error || 'Ошибка при восстановлении'}`);
        }
    } catch (error) {
        showMessage('error', '❌ Ошибка соединения');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

        // Диалог подтверждения
        function confirmDialog(action, type = 'warning') {
            return new Promise((resolve) => {
                const overlay = document.createElement('div');
                overlay.className = 'modal-overlay';
                overlay.innerHTML = `
                    <div class="modal">
                        <div class="modal-icon ${type}">
                            ${type === 'danger' ? '⚠️' : '❓'}
                        </div>
                        <div class="modal-title">Подтверждение действия</div>
                        <div class="modal-text">Вы уверены, что хотите ${action}?</div>
                        <div class="modal-actions">
                            <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove(); resolve(false)">Отмена</button>
                            <button class="btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}" onclick="this.closest('.modal-overlay').remove(); resolve(true)">Подтвердить</button>
                        </div>
                    </div>
                `;
                
                overlay.querySelector('.btn-secondary').onclick = () => {
                    overlay.remove();
                    resolve(false);
                };
                
                overlay.querySelector(`.btn-${type === 'danger' ? 'danger' : 'primary'}`).onclick = () => {
                    overlay.remove();
                    resolve(true);
                };
                
                document.body.appendChild(overlay);
            });
        }

        // Показ сообщения
        function showMessage(type, text) {
            const container = document.getElementById('message-container');
            const id = Date.now();
            
            container.innerHTML += `
                <div class="message ${type}" id="msg-${id}">
                    <span class="message-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                    <span class="message-content">${text}</span>
                    <button class="message-close" onclick="document.getElementById('msg-${id}').remove()">×</button>
                </div>
            `;

            setTimeout(() => {
                const msg = document.getElementById(`msg-${id}`);
                if (msg) msg.remove();
            }, 5000);
        }

        // Форматирование даты
        function formatDate(dateStr) {
            if (!dateStr) return '—';
            const date = new Date(dateStr);
            return date.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        // Экранирование HTML
        function escapeHtml(unsafe) {
            if (!unsafe) return '';
            return String(unsafe)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }
