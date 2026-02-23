
        // Определяем все функции ДО их использования
        let currentUser = null;
        let fieldValidState = {
            clientName: false,
            phone: false,
            address: false,
            problemText: false
        };

        // Правила валидации
        const validationRules = {
            clientName: {
                pattern: /^[a-zA-Zа-яА-ЯёЁ\s\-]{2,50}$/,
                message: 'Только буквы, пробелы и дефисы (2-50 символов)'
            },
            phone: {
                pattern: /^(\+7|8)?[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$|^\d{10,15}$/,
                message: 'Неверный формат телефона'
            },
            address: {
                pattern: /^[a-zA-Zа-яА-ЯёЁ0-9\s\.,\-]{5,100}$/,
                message: 'Буквы, цифры, пробелы, запятые, точки, дефисы (5-100 символов)'
            },
            problemText: {
                pattern: /^[\s\S]{10,500}$/,
                message: 'Минимум 10, максимум 500 символов'
            }
        };

        // Функция валидации поля
        function validateField(fieldId) {
            const field = document.getElementById(fieldId);
            if (!field) return false;
            
            const value = field.value.trim();
            const errorElement = document.getElementById(fieldId + '-error');
            const counterElement = document.getElementById(fieldId + '-counter');
            const rule = validationRules[fieldId];
            
            if (!errorElement || !counterElement) return false;
            
            // Обновляем счетчик
            counterElement.textContent = value.length + '/' + field.maxLength;
            
            // Меняем цвет счетчика
            if (value.length > field.maxLength * 0.9) {
                counterElement.className = 'char-counter danger';
            } else if (value.length > field.maxLength * 0.7) {
                counterElement.className = 'char-counter warning';
            } else {
                counterElement.className = 'char-counter';
            }
            
            // Проверка на пустое поле
            if (!value) {
                field.classList.add('error');
                field.classList.remove('valid');
                errorElement.textContent = 'Поле обязательно для заполнения';
                errorElement.classList.add('show');
                fieldValidState[fieldId] = false;
                updateRulesDisplay(fieldId, false);
                updateSubmitButton();
                return false;
            }
            
            // Проверка по регулярному выражению
            if (rule && !rule.pattern.test(value)) {
                field.classList.add('error');
                field.classList.remove('valid');
                errorElement.textContent = rule.message;
                errorElement.classList.add('show');
                fieldValidState[fieldId] = false;
                updateRulesDisplay(fieldId, false);
                updateSubmitButton();
                return false;
            }
            
            // Поле валидно
            field.classList.remove('error');
            field.classList.add('valid');
            errorElement.classList.remove('show');
            fieldValidState[fieldId] = true;
            updateRulesDisplay(fieldId, true);
            updateSubmitButton();
            return true;
        }

        // Валидация всех полей
        function validateAllFields() {
            validateField('clientName');
            validateField('phone');
            validateField('address');
            validateField('problemText');
        }

        // Обновление отображения правил
        function updateRulesDisplay(fieldId, isValid) {
            const ruleMap = {
                clientName: 'rule-client',
                phone: 'rule-phone',
                address: 'rule-address',
                problemText: 'rule-problem'
            };
            
            const ruleElement = document.getElementById(ruleMap[fieldId]);
            if (ruleElement) {
                if (isValid) {
                    ruleElement.classList.add('valid');
                    ruleElement.classList.remove('invalid');
                } else {
                    ruleElement.classList.add('invalid');
                    ruleElement.classList.remove('valid');
                }
            }
        }

        // Обновление состояния кнопки отправки
        function updateSubmitButton() {
            const allValid = Object.values(fieldValidState).every(value => value === true);
            const submitBtn = document.getElementById('submit-btn');
            if (submitBtn) {
                submitBtn.disabled = !allValid;
            }
        }

        // Форматирование телефона
        function formatPhone(input) {
            let value = input.value.replace(/\D/g, '');
            if (value.length > 0) {
                if (value.startsWith('8') && value.length > 1) {
                    value = '7' + value.substring(1);
                }
                if (!value.startsWith('7')) {
                    value = '7' + value;
                }
                
                if (value.length > 1) {
                    let formatted = '+7';
                    if (value.length > 2) {
                        formatted += ' (' + value.substring(1, 4);
                    }
                    if (value.length > 4) {
                        formatted += ') ' + value.substring(4, 7);
                    }
                    if (value.length > 7) {
                        formatted += '-' + value.substring(7, 9);
                    }
                    if (value.length > 9) {
                        formatted += '-' + value.substring(9, 11);
                    }
                    input.value = formatted;
                }
            }
            validateField('phone');
        }

        // Загрузка информации о пользователе
        async function loadUserInfo() {
            try {
                const response = await fetch('/api/auth/me');
                if (response.ok) {
                    currentUser = await response.json();
                    const header = document.getElementById('user-header');
                    header.style.display = 'flex';
                    document.getElementById('user-name').textContent = 
                        `${currentUser.name || currentUser.role} (${currentUser.role === 'dispatcher' ? 'Диспетчер' : 'Мастер'})`;
                }
            } catch (error) {
                console.error('Error loading user:', error);
            }
        }

        // Выход
        async function logout() {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/';
        }

        // Создание заявки
        async function createRequest() {
            // Финальная валидация
            validateAllFields();
            
            const allValid = Object.values(fieldValidState).every(value => value === true);
            
            if (!allValid) {
                showMessage('error', '❌ Исправьте ошибки в форме');
                return;
            }

            const clientName = document.getElementById('clientName').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const address = document.getElementById('address').value.trim();
            const problemText = document.getElementById('problemText').value.trim();

            const submitBtn = document.getElementById('submit-btn');
            const originalText = submitBtn.textContent;
            submitBtn.innerHTML = '⏳ Создание...';
            submitBtn.disabled = true;

            try {
                const response = await fetch('/api/requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientName, phone, address, problemText })
                });

                const data = await response.json();

                if (response.ok) {
                    showSuccessMessage({
                        id: data.id,
                        clientName,
                        phone,
                        address,
                        problemText
                    });
                    document.getElementById('form-container').style.display = 'none';
                    
                    // Очищаем форму
                    document.getElementById('clientName').value = '';
                    document.getElementById('phone').value = '';
                    document.getElementById('address').value = '';
                    document.getElementById('problemText').value = '';
                } else {
                    showMessage('error', `❌ Ошибка: ${data.error || 'Неизвестная ошибка'}`);
                }
            } catch (error) {
                showMessage('error', '❌ Ошибка соединения с сервером');
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }

        // Показать сообщение
        function showMessage(type, text) {
            const container = document.getElementById('message-container');
            if (!container) return;
            
            container.innerHTML = `
                <div class="message ${type}">
                    <span>${text}</span>
                    <button class="message-close" onclick="this.parentElement.remove()">×</button>
                </div>
            `;
        }

        // Показать сообщение об успехе
        function showSuccessMessage(request) {
            const container = document.getElementById('message-container');
            if (!container) return;
            
            container.innerHTML = `
                <div class="message success">
                    <h3 style="margin-top: 0;">Заявка успешно создана!</h3>
                    <p><strong>Номер заявки:</strong> #${request.id}</p>
                    
                    <div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0;">
                        <p><strong>Клиент:</strong> ${escapeHtml(request.clientName)}</p>
                        <p><strong>Телефон:</strong> ${escapeHtml(request.phone)}</p>
                        <p><strong>Адрес:</strong> ${escapeHtml(request.address)}</p>
                        <p><strong>Проблема:</strong> ${escapeHtml(request.problemText)}</p>
                        <p><strong>Статус:</strong> <span class="status-badge status-new">Новая</span></p>
                    </div>
                    
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick="createNewRequest()">➕ Создать ещё</button>
                        <button class="btn btn-secondary" onclick="window.location.href='/'">🏠 На главную</button>
                        ${getRoleBasedButton()}
                    </div>
                </div>
            `;
        }

        // Создать новую заявку
        function createNewRequest() {
            document.getElementById('form-container').style.display = 'block';
            document.getElementById('message-container').innerHTML = '';
            // Сбрасываем состояние валидации
            fieldValidState = {
                clientName: false,
                phone: false,
                address: false,
                problemText: false
            };
            // Очищаем классы валидации
            ['clientName', 'phone', 'address', 'problemText'].forEach(id => {
                const field = document.getElementById(id);
                if (field) {
                    field.classList.remove('valid', 'error');
                }
            });
            // Сбрасываем отображение правил
            ['rule-client', 'rule-phone', 'rule-address', 'rule-problem'].forEach(id => {
                const rule = document.getElementById(id);
                if (rule) {
                    rule.classList.remove('valid', 'invalid');
                }
            });
            updateSubmitButton();
        }

        // Получить кнопку в зависимости от роли
        function getRoleBasedButton() {
            if (currentUser) {
                if (currentUser.role === 'dispatcher') {
                    return '<button class="btn btn-secondary" onclick="window.location.href=\'/dispatcher.html\'">📋 В панель диспетчера</button>';
                } else if (currentUser.role === 'master') {
                    return '<button class="btn btn-secondary" onclick="window.location.href=\'/master.html\'">🔧 В панель мастера</button>';
                }
            }
            return '';
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

        // Инициализация после загрузки страницы
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM loaded - initializing form validation');
            
            // Загружаем информацию о пользователе
            loadUserInfo();
            
            // Назначаем обработчики событий на поля ввода
            const clientNameField = document.getElementById('clientName');
            const phoneField = document.getElementById('phone');
            const addressField = document.getElementById('address');
            const problemTextField = document.getElementById('problemText');
            
            if (clientNameField) {
                clientNameField.addEventListener('input', function() { validateField('clientName'); });
            }
            
            if (phoneField) {
                phoneField.addEventListener('input', function() { validateField('phone'); });
                phoneField.addEventListener('blur', function() { formatPhone(this); });
            }
            
            if (addressField) {
                addressField.addEventListener('input', function() { validateField('address'); });
            }
            
            if (problemTextField) {
                problemTextField.addEventListener('input', function() { validateField('problemText'); });
            }
            
            // Первоначальная валидация
            validateAllFields();
        });
