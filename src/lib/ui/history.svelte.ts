/** Grows each time an entry is added to the history, so the views showing it read it again. */
export const historyChanged = $state({ rev: 0 });
