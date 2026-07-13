// The read-modify-write stats index this module used to maintain was
// write-only: nothing in the app ever reads the aggregated data back
// (screens compute stats directly from history shards). The machinery was
// removed to stop the wasted AsyncStorage I/O on every set edit / session
// save. The key is kept here because `syncStore.ts` still references it to
// clear out any legacy index left on disk by older app versions during a
// full resync / logout.
export const WORKOUT_STATS_KEY = "workout-stats-index-v1";
