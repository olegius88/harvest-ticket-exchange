<script lang="ts">
  interface LoginData {
    phoneNumber: string;
    password: string;
  }

  interface Props {
    onLogin?: (data: LoginData) => void;
    onShowRegistration?: () => void;
  }

  let { onLogin, onShowRegistration }: Props = $props();

  let phoneNumber = $state('');
  let password = $state('');
  let isLoading = $state(false);
  let errors = $state({
    phoneNumber: '',
    password: '',
  });

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    // Очищаем предыдущие ошибки
    errors = {
      phoneNumber: '',
      password: '',
    };

    let hasErrors = false;

    // Валидация номера телефона
    if (!phoneNumber.trim()) {
      errors.phoneNumber = 'Введите номер телефона';
      hasErrors = true;
    } else if (phoneNumber.trim().length < 10) {
      errors.phoneNumber = 'Номер телефона слишком короткий';
      hasErrors = true;
    }

    // Валидация пароля
    if (!password.trim()) {
      errors.password = 'Введите пароль';
      hasErrors = true;
    } else if (password.trim().length < 4) {
      errors.password = 'Пароль должен содержать минимум 4 символа';
      hasErrors = true;
    }

    // Если есть ошибки, не отправляем форму
    if (hasErrors) {
      return;
    }

    isLoading = true;

    // Имитация задержки загрузки
    setTimeout(() => {
      onLogin?.({ phoneNumber: phoneNumber.trim(), password: password.trim() });
      isLoading = false;
    }, 500);
  }

  function showRegistration() {
    onShowRegistration?.();
  }

  // Очищаем ошибки при изменении полей
  function clearError(fieldName: 'phoneNumber' | 'password') {
    if (errors[fieldName]) {
      errors[fieldName] = '';
    }
  }

  // Вычисляем состояния полей для стилизации
  let phoneNumberStatus = $derived(() => {
    if (errors.phoneNumber) return 'error';
    if (phoneNumber.trim() && phoneNumber.trim().length >= 10) return 'valid';
    return 'default';
  });

  let passwordStatus = $derived(() => {
    if (errors.password) return 'error';
    if (password.trim() && password.trim().length >= 4) return 'valid';
    return 'default';
  });

  // Функция для получения CSS классов поля
  function getFieldClasses(status: string) {
    const baseClasses = 'form-input transition-colors';
    switch (status) {
      case 'error':
        return `${baseClasses} border-red-300 focus:border-red-500 focus:ring-red-500`;
      case 'valid':
        return `${baseClasses} border-green-300 focus:border-green-500 focus:ring-green-500`;
      default:
        return baseClasses;
    }
  }
</script>

<div class="h-full flex items-center justify-center p-4">
  <div class="card w-full max-w-md p-6 space-y-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold text-gray-900">Вход в систему</h1>
      <p class="text-gray-600 mt-2">Модуль "Весовщик"</p>
    </div>

    <form onsubmit={handleSubmit} novalidate class="space-y-4">
      <div>
        <label for="phoneNumber" class="block text-sm font-medium text-gray-700 mb-1">
          Номер телефона
        </label>
        <input
          id="phoneNumber"
          type="tel"
          bind:value={phoneNumber}
          oninput={() => clearError('phoneNumber')}
          class={getFieldClasses(phoneNumberStatus)}
          placeholder="+7 (999) 123-45-67"
          disabled={isLoading}
        />
        {#if errors.phoneNumber}
          <p class="text-red-600 text-xs mt-1 flex items-center">
            <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clip-rule="evenodd"
              />
            </svg>
            {errors.phoneNumber}
          </p>
        {/if}
      </div>

      <div>
        <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          oninput={() => clearError('password')}
          class={getFieldClasses(passwordStatus)}
          placeholder="Введите пароль"
          disabled={isLoading}
        />
        {#if errors.password}
          <p class="text-red-600 text-xs mt-1 flex items-center">
            <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clip-rule="evenodd"
              />
            </svg>
            {errors.password}
          </p>
        {/if}
      </div>

      <div class="space-y-3">
        <button type="submit" class="btn btn-primary w-full" disabled={isLoading}>
          {#if isLoading}
            <span class="inline-flex items-center">
              <svg
                class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Вход...
            </span>
          {:else}
            Войти
          {/if}
        </button>

        <button
          type="button"
          onclick={showRegistration}
          class="btn btn-outline w-full"
          disabled={isLoading}
        >
          Регистрация
        </button>
      </div>
    </form>
  </div>
</div>
