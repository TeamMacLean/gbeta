<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TrackView from '$lib/components/TrackView.svelte';
	import SessionRestoreBanner from '$lib/components/SessionRestoreBanner.svelte';
	import QueryConsole from '$lib/components/QueryConsole.svelte';
	import AIChat from '$lib/components/AIChat.svelte';
</script>

<Header />
<SessionRestoreBanner />

<main class="flex flex-1 overflow-hidden">
	<Sidebar />
	<TrackView />
</main>

<QueryConsole />
<AIChat />
