<template>
  <div class="default-layout">
    <header>Header de la aplicación</header>
    <main>
      <slot />
    </main>
    <footer>Footer de la aplicación</footer>
  </div>
</template>

<style scoped>
.default-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
</style>
