export function initializeSignupValidation() {
    const form = document.querySelector('.signup-form');
    const usernameInput = document.getElementById('signup-username');
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    const confirmPasswordInput = document.getElementById('signup-confirm-password');
    const submitButton = document.getElementById('signup-submit');

    // 验证规则
    const validators = {
        username: {
            pattern: /^[a-zA-Z0-9]{1,20}$/,
            message: 'Username must be 1-20 characters long and contain only letters and numbers'
        },
        email: {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Please enter a valid email address'
        },
        password: {
            pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/,
            message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character'
        }
    };

    // 验证函数
    function validateInput(input, validationType, showError = false) {
        const validationMessage = input.parentElement.querySelector('.validation-message');
        let isValid = false;

        if (!input.value) {
            validationMessage.textContent = showError ? 'This field is required' : '';
            isValid = false;
        } else if (validationType === 'confirm-password') {
            isValid = input.value === passwordInput.value;
            validationMessage.textContent = showError && !isValid ? 'Passwords do not match' : '';
        } else {
            isValid = validators[validationType].pattern.test(input.value);
            validationMessage.textContent = showError && !isValid ? validators[validationType].message : '';
        }

        // 只在有值时显示验证状态
        if (input.value) {
            input.classList.toggle('valid', isValid);
            input.classList.toggle('invalid', !isValid);
        } else {
            input.classList.remove('valid', 'invalid');
        }

        return isValid;
    }

    // 检查表单有效性
    function checkFormValidity(showErrors = false) {
        const isUsernameValid = validateInput(usernameInput, 'username', showErrors);
        const isEmailValid = validateInput(emailInput, 'email', showErrors);
        const isPasswordValid = validateInput(passwordInput, 'password', showErrors);
        const isConfirmPasswordValid = validateInput(confirmPasswordInput, 'confirm-password', showErrors);

        submitButton.disabled = !(isUsernameValid && isEmailValid && 
                                isPasswordValid && isConfirmPasswordValid);
    }

    // 添加输入事件监听器
    const inputs = [
        { element: usernameInput, type: 'username' },
        { element: emailInput, type: 'email' },
        { element: passwordInput, type: 'password' },
        { element: confirmPasswordInput, type: 'confirm-password' }
    ];

    inputs.forEach(({ element, type }) => {
        // 输入时验证但不显示错误消息
        element.addEventListener('input', () => {
            validateInput(element, type, false);
            checkFormValidity(false);
        });

        // 失去焦点时验证并显示错误消息
        element.addEventListener('blur', () => {
            validateInput(element, type, true);
            checkFormValidity(false);
        });

        // 获得焦点时清除错误消息
        element.addEventListener('focus', () => {
            element.parentElement.querySelector('.validation-message').textContent = '';
        });
    });

    // 表单提交验证
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        checkFormValidity(true);
        
        if (!submitButton.disabled) {
            console.log('Form submitted successfully');
        }
    });
}