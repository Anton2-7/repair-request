        // Состояние
        let currentUser = null;
        let masters = [];
        let activeRequests = [];
        let archivedRequests = [];
        let currentView = 'active'; // 'active' или 'archived'
        let currentStatusFilter = '';
        let searchTimeout;

        // Загрузка данных при старте
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Dispatcher page loaded');
            loadUserInfo();
            loadMasters();
            loadActiveRequests();
            loadArchivedRequests();
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
                console.error('Error loading user:', error);
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
                    console.log('Masters loaded:', masters);
                }
            } catch (error) {
                console.error('Error loading masters:', error);
                showMessage('error', 'Ошибка загрузки списка мастеров');
            }
        }

        // Загрузка активных заявок (без архива)
        async function loadActiveRequests() {
            try {
                let url = '/api/requests';
                if (currentStatusFilter) {
                    url += '?status=' + encodeURIComponent(currentStatusFilter);
                }
                
                console.log('Loading active requests from:', url);
                
                const response = await fetch(url);
                if (!response.ok) throw new Error('Ошибка загрузки');
                
                activeRequests = await response.json();
                console.log('Loaded active requests:', activeRequests.length);
                
                if (currentView === 'active') {
                    filterAndDisplayRequests();
                }
                updateStats();
            } catch (error) {
                console.error('Error loading active requests:', error);
                showMessage('error', 'Ошибка загрузки активных заявок');
            }
        }

        // Загрузка архивных заявок
        async function loadArchivedRequests() {
            try {
                console.log('Loading archived requests from: /api/requests/archived');
                
                const response = await fetch('/api/requests/archived');
                if (!response.ok) throw new Error('Ошибка загрузки');
                
                archivedRequests = await response.json();
                console.log('Loaded archived requests:', archivedRequests.length);
                
                if (currentView === 'archived') {
                    filterAndDisplayRequests();
                }
                updateStats();
            } catch (error) {
                console.error('Error loading archived requests:', error);
                showMessage('error', 'Ошибка загрузки архивных заявок');
            }
        }

        // Показать активные заявки
        function showActiveRequests() {
            currentView = 'active';
            document.getElementById('tab-active').classList.add('active');
            document.getElementById('tab-archive').classList.remove('active');
            document.getElementById('archiveInfo').style.display = 'none';
            document.getElementById('stat-new-card').style.display = 'flex';
            document.getElementById('stat-assigned-card').style.display = 'flex';
            document.getElementById('stat-progress-card').style.display = 'flex';
            document.getElementById('stat-done-card').style.display = 'flex';
            document.getElementById('stat-canceled-card').style.display = 'flex';
            filterAndDisplayRequests();
        }

        // Показать архив
        function showArchive() {
            currentView = 'archived';
            document.getElementById('tab-archive').classList.add('active');
            document.getElementById('tab-active').classList.remove('active');
            document.getElementById('archiveInfo').style.display = 'flex';
            filterAndDisplayRequests();
        }

        // Фильтр по статусу из статистики
        function filterByStatus(status) {
            currentStatusFilter = status;
            showActiveRequests();
            loadActiveRequests();
        }

        // Фильтрация и отображение заявок
        function filterAndDisplayRequests() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            
            let requestsToShow = currentView === 'active' ? activeRequests : archivedRequests;
            
            // Применяем поиск
            if (searchTerm) {
                requestsToShow = requestsToShow.filter(req => {
                    const searchable = `${req.clientName} ${req.phone} ${req.address} ${req.problemText}`.toLowerCase();
                    return searchable.includes(searchTerm);
                });
            }

            renderRequests(requestsToShow);
        }

        // Поиск с debounce
        function debounceSearch() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(filterAndDisplayRequests, 300);
        }

        // Сброс фильтров
        function resetFilters() {
            document.getElementById('searchInput').value = '';
            currentStatusFilter = '';
            showActiveRequests();
            loadActiveRequests();
        }

        // Обновление статистики
        function updateStats() {
            document.getElementById('stat-new').textContent = activeRequests.filter(r => r.status === 'new').length;
            document.getElementById('stat-assigned').textContent = activeRequests.filter(r => r.status === 'assigned').length;
            document.getElementById('stat-progress').textContent = activeRequests.filter(r => r.status === 'in_progress').length;
            document.getElementById('stat-done').textContent = activeRequests.filter(r => r.status === 'done').length;
            document.getElementById('stat-canceled').textContent = activeRequests.filter(r => r.status === 'canceled').length;
            document.getElementById('stat-archived').textContent = archivedRequests.length;
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
                    'deleted': '📦 В архиве'
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

        // Отображение действий в зависимости от статуса и режима
        function renderActions(req) {
            // В архиве
            if (currentView === 'archived') {
                return `
                    <button class="btn btn-warning btn-sm" onclick="restoreRequest(${req.id})">
                        <span class="btn-icon">🔄</span> Восстановить
                    </button>
                `;
            }

            // В активных заявках
            if (req.status === 'new') {
                return `
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
                return `<div class="status-info">⏳ Ожидает мастера</div>`;
            }

            if (req.status === 'in_progress') {
                return `
                    <div class="status-info">⚙️ В работе</div>
                    <button class="btn btn-danger btn-sm" onclick="cancelRequest(${req.id})">
                        <span class="btn-icon">✗</span> Отменить
                    </button>
                `;
            }

            if (req.status === 'done') {
                return `
                    <span class="status-info completed">✓ Завершена</span>
                    <button class="btn btn-secondary btn-sm" onclick="archiveRequest(${req.id})">
                        <span class="btn-icon">📦</span> В архив
                    </button>
                `;
            }

            if (req.status === 'canceled') {
                return `
                    <span class="status-info canceled">✗ Отменена</span>
                    <button class="btn btn-secondary btn-sm" onclick="archiveRequest(${req.id})">
                        <span class="btn-icon">📦</span> В архив
                    </button>
                `;
            }

            return '';
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
                    await loadActiveRequests();
                } else {
                    const data = await response.json();
                    showMessage('error', data.error || 'Ошибка при назначении');
                }
            } catch (error) {
                console.error('Assign error:', error);
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
                    await loadActiveRequests();
                } else {
                    const data = await response.json();
                    showMessage('error', data.error || 'Ошибка при отмене');
                }
            } catch (error) {
                console.error('Cancel error:', error);
                showMessage('error', 'Ошибка соединения');
            } finally {
                button.innerHTML = originalText;
                button.disabled = false;
            }
        }

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
                    await loadActiveRequests();
                    await loadArchivedRequests();
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

        // Восстановление из архива
        async function restoreRequest(requestId) {
            if (!await confirmDialog('восстановить заявку из архива')) return;

            const button = event.target;
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="loading-spinner"></span> Восстановление...';
            button.disabled = true;

            try {
                console.log('Restoring request:', requestId);
                
                const response = await fetch(`/api/requests/${requestId}/restore`, {
                    method: 'PATCH'
                });

                const data = await response.json();
                console.log('Restore response:', response.status, data);

                if (response.ok) {
                    showMessage('success', '✅ Заявка восстановлена из архива');
                    await loadActiveRequests();
                    await loadArchivedRequests();
                    if (currentView === 'archived') {
                        filterAndDisplayRequests();
                    }
                } else {
                    showMessage('error', `❌ ${data.error || 'Ошибка при восстановлении'}`);
                }
            } catch (error) {
                console.error('Restore error:', error);
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
                            <button class="btn btn-secondary" id="modal-cancel">Отмена</button>
                            <button class="btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}" id="modal-confirm">Подтвердить</button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(overlay);
                
                document.getElementById('modal-cancel').onclick = () => {
                    document.body.removeChild(overlay);
                    resolve(false);
                };
                
                document.getElementById('modal-confirm').onclick = () => {
                    document.body.removeChild(overlay);
                    resolve(true);
                };
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
