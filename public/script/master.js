        let currentUser = null;
        let allRequests = [];

        // Функция для безопасного показа сообщений
        function showMessage(type, text) {
            const container = document.getElementById('message-container');
            if (!container) {
                console.error('Message container not found');
                // Пробуем создать контейнер, если его нет
                const body = document.querySelector('.container');
                if (body) {
                    const newContainer = document.createElement('div');
                    newContainer.id = 'message-container';
                    body.insertBefore(newContainer, body.querySelector('.table-container'));
                    showMessage(type, text);
                }
                return;
            }
            
            container.innerHTML = `
                <div class="message ${type}">
                    <span class="message-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                    <span>${text}</span>
                    <button class="message-close" onclick="this.parentElement.remove()">×</button>
                </div>
            `;
            
            // Автоматически скрываем через 5 секунд
            setTimeout(() => {
                const msg = container.querySelector('.message');
                if (msg) msg.remove();
            }, 5000);
        }

        // Ждем полной загрузки DOM
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Master page DOM loaded');
            loadUserInfo();
            loadRequests();
        });

        async function loadUserInfo() {
            try {
                const response = await fetch('/api/auth/me');
                if (response.ok) {
                    currentUser = await response.json();
                    const header = document.getElementById('user-header');
                    if (header) {
                        const userInfo = header.querySelector('.user-info');
                        if (userInfo) {
                            userInfo.innerHTML = `
                                <span class="user-avatar">👤</span>
                                <span><strong>${currentUser.name || currentUser.role}</strong> (Мастер)</span>
                            `;
                        }
                    }
                } else {
                    window.location.href = '/';
                }
            } catch (error) {
                console.error('Error loading user info:', error);
                showMessage('error', 'Ошибка загрузки данных пользователя');
            }
        }

        async function logout() {
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
            } catch (error) {
                console.error('Logout error:', error);
            }
            window.location.href = '/';
        }

        async function loadRequests() {
            const status = document.getElementById('statusFilter')?.value || '';
            let url = '/api/requests';
            
            if (status) {
                url += '?status=' + encodeURIComponent(status);
            }
            
            console.log('Loading requests with URL:', url);

            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const requests = await response.json();
                console.log('Received requests:', requests);
                allRequests = requests;
                renderRequests(requests);
                updateStats(requests);
            } catch (error) {
                console.error('Error loading requests:', error);
                showMessage('error', 'Ошибка загрузки заявок');
                const tbody = document.getElementById('requestsBody');
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="7" class="text-center error-message">Ошибка загрузки данных. Попробуйте обновить страницу.</td></tr>';
                }
            }
        }

        function updateStats(requests) {
            const statsCard = document.getElementById('stats-card');
            if (!statsCard) return;
            
            if (requests.length > 0) {
                statsCard.style.display = 'flex';
                
                const total = requests.length;
                const assigned = requests.filter(r => r.status === 'assigned').length;
                const inProgress = requests.filter(r => r.status === 'in_progress').length;
                const done = requests.filter(r => r.status === 'done').length;
                
                document.getElementById('total-count').textContent = total;
                document.getElementById('assigned-count').textContent = assigned;
                document.getElementById('progress-count').textContent = inProgress;
                document.getElementById('done-count').textContent = done;
            } else {
                statsCard.style.display = 'none';
            }
        }

        function renderRequests(requests) {
            const tbody = document.getElementById('requestsBody');
            if (!tbody) return;
            
            if (!requests || requests.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center">Нет заявок</td></tr>';
                return;
            }

            tbody.innerHTML = requests.map(req => {
                const statusClass = `status-badge status-${req.status}`;
                const statusText = {
                    'new': 'Новая',
                    'assigned': 'Назначена',
                    'in_progress': 'В работе',
                    'done': 'Выполнена',
                    'canceled': 'Отменена'
                }[req.status] || req.status;

                return `
                    <tr>
                        <td><span class="request-id">#${req.id}</span></td>
                        <td>${escapeHtml(req.clientName)}</td>
                        <td>${escapeHtml(req.phone)}</td>
                        <td>${escapeHtml(req.address)}</td>
                        <td class="problem-cell" title="${escapeHtml(req.problemText)}">${escapeHtml(req.problemText)}</td>
                        <td><span class="${statusClass}">${statusText}</span></td>
                        <td>
                            <div class="table-actions">
                                ${req.status === 'assigned' ? `
                                    <button class="btn-success btn-sm" onclick="takeRequest(${req.id})">
                                        <span class="btn-icon">▶️</span> Взять в работу
                                    </button>
                                ` : ''}
                                
                                ${req.status === 'in_progress' ? `
                                    <button class="btn-primary btn-sm" onclick="completeRequest(${req.id})">
                                        <span class="btn-icon">✅</span> Завершить
                                    </button>
                                ` : ''}
                                
                                ${req.status === 'done' ? `
                                    <span class="status-info completed">✓ Завершена</span>
                                ` : ''}
                                
                                ${req.status === 'canceled' ? `
                                    <span class="status-info canceled">✗ Отменена</span>
                                ` : ''}
                                
                                ${req.status === 'new' ? `
                                    <span class="status-info">🆕 Новая (ожидает назначения)</span>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        async function takeRequest(requestId) {
            const button = event.target;
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="loading-spinner"></span> Взятие...';
            button.disabled = true;

            try {
                const response = await fetch(`/api/requests/${requestId}/take`, {
                    method: 'PATCH'
                });

                if (response.ok) {
                    showMessage('success', '✅ Заявка взята в работу');
                    await loadRequests();
                } else if (response.status === 409) {
                    const data = await response.json();
                    showMessage('error', data.error || '❌ Заявка уже взята другим мастером');
                } else {
                    showMessage('error', '❌ Ошибка при взятии заявки');
                }
            } catch (error) {
                console.error('Take error:', error);
                showMessage('error', '❌ Ошибка соединения с сервером');
            } finally {
                button.innerHTML = originalText;
                button.disabled = false;
            }
        }

        async function completeRequest(requestId) {
            const button = event.target;
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="loading-spinner"></span> Завершение...';
            button.disabled = true;

            try {
                const response = await fetch(`/api/requests/${requestId}/complete`, {
                    method: 'PATCH'
                });

                if (response.ok) {
                    showMessage('success', '✅ Заявка завершена');
                    await loadRequests();
                } else {
                    const data = await response.json();
                    showMessage('error', `❌ ${data.error || 'Ошибка при завершении'}`);
                }
            } catch (error) {
                console.error('Complete error:', error);
                showMessage('error', '❌ Ошибка соединения с сервером');
            } finally {
                button.innerHTML = originalText;
                button.disabled = false;
            }
        }

        function applyFilter() {
            loadRequests();
        }

        function escapeHtml(unsafe) {
            if (!unsafe) return '';
            return String(unsafe)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }
