<script lang="ts">
  interface RegistrationData {
    phoneNumber: string;
    password: string;
    confirmPassword: string;
  }

  interface Props {
    onRegister?: (data: RegistrationData) => Promise<void>;
    onShowLogin?: () => void;
  }

  let { onRegister, onShowLogin }: Props = $props();

  let phoneNumber = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let isLoading = $state(false);
  let registrationError = $state('');

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!phoneNumber || !password || !confirmPassword) return;
    if (password !== confirmPassword) return;

    isLoading = true;
    registrationError = '';

    try {
      await onRegister?.({ phoneNumber, password, confirmPassword });
      console.log('Registration successful');
    } catch (error) {
      console.error('Registration error:', error);
      registrationError = error instanceof Error ? error.message : 'Неизвестная ошибка';
    } finally {
      isLoading = false;
    }
  }

  function showLogin() {
    onShowLogin?.();
  }

  let passwordsMatch = $derived(password === confirmPassword);
</script>

<div class="h-full flex items-center justify-center p-4">
  <div class="card w-full max-w-md p-6 space-y-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold text-gray-900">Регистрация</h1>
      <p class="text-gray-600 mt-2">Создание нового пользователя</p>
    </div>

    <form onsubmit={handleSubmit} class="space-y-4">
      <div>
        <label for="reg-phoneNumber" class="block text-sm font-medium text-gray-700 mb-1">
          Номер телефона
        </label>
        <input
          id="reg-phoneNumber"
          type="tel"
          bind:value={phoneNumber}
          class="form-input"
          placeholder="+7 (999) 123-45-67"
          disabled={isLoading}
          required
        />
      </div>

      <div>
        <label for="reg-password" class="block text-sm font-medium text-gray-700 mb-1">
          Пароль
        </label>
        <input
          id="reg-password"
          type="password"
          bind:value={password}
          class="form-input"
          placeholder="Введите пароль"
          disabled={isLoading}
          required
        />
      </div>

      <div>
        <label for="confirm-password" class="block text-sm font-medium text-gray-700 mb-1">
          Подтвердите пароль
        </label>
        <input
          id="confirm-password"
          type="password"
          bind:value={confirmPassword}
          class="form-input"
          class:border-red-300={confirmPassword && !passwordsMatch}
          class:focus:border-red-500={confirmPassword && !passwordsMatch}
          placeholder="Повторите пароль"
          disabled={isLoading}
          required
        />
        {#if confirmPassword && !passwordsMatch}
          <p class="text-red-600 text-xs mt-1">Пароли не совпадают</p>
        {/if}
      </div>

      {#if registrationError}
        <div class="bg-red-50 border border-red-200 rounded-md p-3">
          <div class="flex">
            <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clip-rule="evenodd"
              />
            </svg>
            <p class="text-sm text-red-700">{registrationError}</p>
          </div>
        </div>
      {/if}

      <div class="space-y-3">
        <button
          type="submit"
          class="btn btn-primary w-full"
          disabled={isLoading || !phoneNumber || !password || !confirmPassword || !passwordsMatch}
        >
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
              Регистрация...
            </span>
          {:else}
            Зарегистрироваться
          {/if}
        </button>

        <button
          type="button"
          onclick={showLogin}
          class="btn btn-outline w-full"
          disabled={isLoading}
        >
          Назад к входу
        </button>
      </div>
    </form>
  </div>
</div>
