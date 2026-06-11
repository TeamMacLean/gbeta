<script lang="ts">
	import '../app.css';
	// Initialize theme store - this applies the saved theme class to document root
	import { useTheme } from '$lib/stores/theme.svelte';
	const _theme = useTheme();

	let { children } = $props();
</script>

<svelte:head>
	<title>gBeta - Genome Browser</title>
	<meta name="description" content="A modern, lightweight genome browser with AI-powered navigation" />
</svelte:head>

<div class="min-h-screen flex flex-col bg-[var(--color-bg-primary)]">
	{@render children()}
</div>
