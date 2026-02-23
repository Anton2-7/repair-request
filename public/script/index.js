        // Состояние
        let isLoading = false;

        // Валидация имени пользователя
        function validateUsername() {
            const usernameInput = document.getElementById('username');
            const errorElement = document.getElementById('username-error');
            const value = usernameInput.value.trim();

            if (!value) {
                usernameInput.classList.add('error');
                usernameInput.classList.remove('valid');
                errorElement.textContent = 'Введите имя пользователя';
                errorElement.classList.add('show');
                return false;
            }

            if (value.length < 3) {
                usernameInput.classList.add('error');
                usernameInput.classList.remove('valid');
                errorElement.textContent = 'Минимум 3 символа';
                errorElement.classList.add('show');
                return false;
            }

            if (!/^[a-zA-Z0-9_]+$/.test(value)) {
                usernameInput.classList.add('error');
                usernameInput.classList.remove('valid');
                errorElement.textContent = 'Только буквы, цифры и _';
                errorElement.classList.add('show');
                return false;
            }

            usernameInput.classList.remove('error');
            usernameInput.classList.add('valid');
            errorElement.classList.remove('show');
            return true;
        }

        // Показать сообщение
        function showMessage(type, text) {
            const container = document.getElementById('message-container');
            if (!container) return;

            container.innerHTML = `
                <div class="message ${type}">
                    <span>${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'} ${text}</span>
                    <button class="message-close" onclick="this.parentElement.remove()">×</button>
                </div>
            `;

            // Автоматически скрываем через 5 секунд
            setTimeout(() => {
                const message = container.querySelector('.message');
                if (message) message.remove();
            }, 5000);
        }

        // Установка состояния загрузки
        function setLoading(loading) {
            isLoading = loading;
            const loginBtn = document.getElementById('login-btn');
            const usernameInput = document.getElementById('username');
            
            if (loading) {
                loginBtn.innerHTML = '<span class="loading-spinner"></span> Вход...';
                loginBtn.disabled = true;
                usernameInput.disabled = true;
            } else {
                loginBtn.innerHTML = '<span class="btn-icon">🚪</span> Войти в систему';
                loginBtn.disabled = false;
                usernameInput.disabled = false;
            }
        }

        // Основная функция входа
        async function login() {
            // Валидация
            if (!validateUsername()) {
                return;
            }

            const username = document.getElementById('username').value.trim();
            
            setLoading(true);

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username })
                });

                const data = await response.json();

                if (response.ok) {
                    showMessage('success', '✓ Успешный вход! Перенаправление...');
                    
                    // Перенаправляем в зависимости от роли
                    setTimeout(() => {
                        if (data.role === 'dispatcher') {
                            window.location.href = '/dispatcher.html';
                        } else {
                            window.location.href = '/master.html';
                        }
                    }, 500);
                } else {
                    showMessage('error', `❌ Ошибка: ${data.error || 'Пользователь не найден'}`);
                    setLoading(false);
                }
            } catch (error) {
                console.error('Login error:', error);
                showMessage('error', '❌ Ошибка соединения с сервером');
                setLoading(false);
            }
        }

        // Быстрый вход по клику на пользователя
        function quickLogin(username) {
            document.getElementById('username').value = username;
            validateUsername();
            login();
        }

        // Обработчики событий
        document.addEventListener('DOMContentLoaded', function() {
            const usernameInput = document.getElementById('username');
            
            // Валидация при вводе
            usernameInput.addEventListener('input', validateUsername);
            
            // Вход по Enter
            usernameInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !isLoading) {
                    login();
                }
            });

            // Убираем подсветку при фокусе
            usernameInput.addEventListener('focus', function() {
                this.classList.remove('error', 'valid');
            });

            // Первоначальная валидация
            validateUsername();
        });

        // Предотвращаем повторную отправку формы
        window.addEventListener('load', function() {
            const loginBtn = document.getElementById('login-btn');
            if (loginBtn) {
                loginBtn.addEventListener('click', function(e) {
                    if (isLoading) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                });
            }
        });
