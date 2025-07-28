<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';

  onMount(() => {
    // Инициализация Tauri при запуске приложения
    console.log('SvelteKit app initialized');
  });
</script>

<main class="h-full">
  <slot />
</main>
