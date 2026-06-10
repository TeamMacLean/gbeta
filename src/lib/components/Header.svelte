<script lang="ts">
	import { useViewport } from '$lib/stores/viewport.svelte';
	import { useAssembly, BUILTIN_ASSEMBLIES } from '$lib/stores/assembly.svelte';
	import { formatCoordinate, parseCoordinate } from '$lib/types/genome';
	import { isAIConfigured } from '$lib/services/ai';
	import SearchBar from './SearchBar.svelte';
	import Settings from './Settings.svelte';

	const viewport = useViewport();
	const assembly = useAssembly();

	let showSettings = $state(false);
	const aiConfigured = $derived(isAIConfigured());

	let coordinateInput = $state('');
	let inputError = $state('');
	let showAssemblyMenu = $state(false);
	let chromSizesInput: HTMLInputElement;
	let isLoadingAssembly = $state(false);

	// Sync input with viewport
	$effect(() => {
		coordinateInput = formatCoordinate(
			viewport.current.chromosome,
			viewport.current.start,
			viewport.current.end
		);
	});

	function handleCoordinateSubmit(event: Event) {
		event.preventDefault();
		const parsed = parseCoordinate(coordinateInput);
		if (parsed) {
			viewport.setViewport(parsed);
			inputError = '';
		} else {
			inputError = 'Invalid format. Use chr1:1000-2000 or NC_000913.3:1000-2000';
		}
	}

	function handleChromosomeChange(event: Event) {
		const chr = (event.target as HTMLSelectElement).value;
		const chrInfo = assembly.getChromosome(chr);
		// Navigate to start of chromosome
		viewport.navigateTo(chr, 0, Math.min(chrInfo?.length ?? 100000, 100000));
	}

	function handleAssemblyChange(assemblyId: string) {
		assembly.setAssemblyById(assemblyId);
		showAssemblyMenu = false;

		// Use assembly-specific default viewport if available, otherwise use first chromosome
		const defaultView = assembly.current.defaultViewport;
		if (defaultView) {
			viewport.navigateTo(defaultView.chromosome, defaultView.start, defaultView.end);
		} else {
			const firstChr = assembly.chromosomes[0];
			if (firstChr) {
				const chrInfo = assembly.getChromosome(firstChr);
				viewport.navigateTo(firstChr, 0, Math.min(chrInfo?.length ?? 100000, 100000));
			}
		}
	}

	async function handleChromSizesFile(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		isLoadingAssembly = true;
		try {
			const customAssembly = await assembly.loadFromFile(file);
			if (customAssembly) {
				assembly.setAssembly(customAssembly);
				const firstChr = customAssembly.chromosomes[0];
				if (firstChr) {
					viewport.navigateTo(firstChr.name, 0, Math.min(firstChr.length, 100000));
				}
			}
		} catch (error) {
			console.error('Failed to load chrom.sizes:', error);
		} finally {
			isLoadingAssembly = false;
			showAssemblyMenu = false;
			input.value = '';
		}
	}
</script>

<header class="flex items-center gap-4 px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
	<!-- Logo / Title -->
	<div class="flex items-center gap-2">
		<span class="text-xl font-bold text-[var(--color-accent)]">GBetter</span>
		<span class="text-xs text-[var(--color-text-muted)]">v0.1.0</span>
	</div>

	<!-- Assembly Selector -->
	<div class="relative">
		<button
			onclick={() => showAssemblyMenu = !showAssemblyMenu}
			class="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-border)] transition-colors"
			title="Select genome assembly"
		>
			<span class="text-[var(--color-text-secondary)]">{assembly.current.name}</span>
			<svg class="w-3 h-3 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</button>
		{#if showAssemblyMenu}
			<div class="absolute top-full left-0 mt-1 py-1 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded shadow-lg z-50 min-w-52 max-h-96 overflow-y-auto">
				{#each assembly.assembliesByCategory as { category, species }}
					<!-- Category header -->
					<div class="px-3 py-1.5 text-[10px] font-bold text-[var(--color-accent)] uppercase tracking-wider bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] sticky top-0">
						{category}
					</div>
					{#each species as { name: speciesName, assemblies }}
						<!-- Species subheader -->
						<div class="px-3 py-1 text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]">
							{speciesName}
						</div>
						{#each assemblies as asm}
							<button
								onclick={() => handleAssemblyChange(asm.id)}
								class="w-full pl-5 pr-3 py-1 text-left text-xs hover:bg-[var(--color-border)] transition-colors flex justify-between items-center"
								class:bg-[var(--color-accent)]={assembly.current.id === asm.id}
								class:text-white={assembly.current.id === asm.id}
							>
								<span class="font-medium">{asm.name}</span>
							</button>
						{/each}
					{/each}
				{/each}
				{#if assembly.hasInferred}
					<div class="border-t border-[var(--color-border)] my-1"></div>
					<button
						onclick={() => { assembly.useInferredAssembly(); showAssemblyMenu = false; }}
						class="w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--color-border)] text-indigo-400 transition-colors"
					>
						Use inferred from data
					</button>
				{/if}
				<div class="border-t border-[var(--color-border)] my-1"></div>
				<label
					class="w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--color-border)] text-emerald-400 transition-colors cursor-pointer flex items-center gap-2"
				>
					<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
					</svg>
					{isLoadingAssembly ? 'Loading...' : 'Load .chrom.sizes file...'}
					<input
						bind:this={chromSizesInput}
						type="file"
						accept=".sizes,.txt,.chrom.sizes,.genome"
						class="hidden"
						onchange={handleChromSizesFile}
					/>
				</label>
			</div>
		{/if}
	</div>

	<!-- Chromosome Selector -->
	<select
		value={viewport.current.chromosome}
		onchange={handleChromosomeChange}
		class="px-2 py-1.5 text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text-primary)]"
	>
		{#each assembly.chromosomes as chr}
			<option value={chr}>{chr}</option>
		{/each}
	</select>

	<!-- Coordinate Input -->
	<form onsubmit={handleCoordinateSubmit} class="flex items-center gap-2">
		<input
			type="text"
			bind:value={coordinateInput}
			placeholder="chr:start-end"
			data-testid="coordinate-input"
			class="w-48 px-3 py-1.5 text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
		/>
		<button
			type="submit"
			class="px-3 py-1.5 text-sm bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded transition-colors"
		>
			Go
		</button>
	</form>
	{#if inputError}
		<span class="text-xs text-red-400">{inputError}</span>
	{/if}

	<!-- Zoom Controls -->
	<div class="flex items-center gap-1">
		<button
			onclick={() => viewport.zoomOut()}
			class="px-2 py-1 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] border border-[var(--color-border)] rounded transition-colors"
			title="Zoom out"
		>
			−
		</button>
		<span class="text-xs text-[var(--color-text-secondary)] min-w-16 text-center">
			{viewport.width.toLocaleString()} bp
		</span>
		<button
			onclick={() => viewport.zoomIn()}
			class="px-2 py-1 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] border border-[var(--color-border)] rounded transition-colors"
			title="Zoom in"
		>
			+
		</button>
	</div>

	<!-- AI Search Bar (takes remaining space) -->
	<div class="flex-1">
		<SearchBar />
	</div>

	<!-- Settings Button -->
	<button
		onclick={() => showSettings = true}
		class="relative p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
		title="Settings"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
		</svg>
		{#if !aiConfigured}
			<span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full" title="AI not configured"></span>
		{/if}
	</button>
</header>

<Settings bind:isOpen={showSettings} />
