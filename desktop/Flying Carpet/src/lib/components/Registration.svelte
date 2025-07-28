<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let username = '';
  let password = '';
  let confirmPassword = '';
  let isLoading = false;

  function handleSubmit() {
    if (!username || !password || !confirmPassword) return;

    isLoading = true;

    setTimeout(() => {
      dispatch('register', { username, password, confirmPassword });
      isLoading = false;
    }, 500);
  }

  function showLogin() {
    dispatch('showLogin');
  }

  $: passwordsMatch = password === confirmPassword;
</script>

<div class="h-full flex items-center justify-center p-4">
  <div class="card w-full max-w-md p-6 space-y-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold text-gray-900">Регистрация</h1>
      <p class="text-gray-600 mt-2">Создание нового пользователя</p>
    </div>

    <form on:submit|preventDefault={handleSubmit} class="space-y-4">
      <div>
        <label for="reg-username" class="block text-sm font-medium text-gray-700 mb-1">
          Имя пользователя
        </label>
        <input
          id="reg-username"
          type="text"
          bind:value={username}
          class="form-input"
          placeholder="Введите имя пользователя"
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

      <div class="space-y-3">
        <button
          type="submit"
          class="btn btn-primary w-full"
          disabled={isLoading || !username || !password || !confirmPassword || !passwordsMatch}
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
          on:click={showLogin}
          class="btn btn-outline w-full"
          disabled={isLoading}
        >
          Назад к входу
        </button>
      </div>
    </form>
  </div>
</div>
