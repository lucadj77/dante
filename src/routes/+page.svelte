<script lang="ts">
  import type { Project } from "$lib/core/project";
  import Welcome from "$lib/ui/Welcome.svelte";
  import Workspace from "$lib/ui/Workspace.svelte";

  let project = $state.raw<Project | null>(null);
</script>

{#if project}
  <Workspace {project} onClose={() => (project = null)} />
{:else}
  <Welcome onOpen={(p) => (project = p)} />
{/if}
