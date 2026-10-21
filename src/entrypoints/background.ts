import { startBackground } from '@/background';
import { startActionIcon } from '@/background/action-icon';

// Listener registration must stay synchronous. MV3 terminates idle service workers, and a
// listener attached after an await would miss the very event that woke the worker up —
// which is exactly the cold start this extension has to survive.
export default defineBackground(() => {
  startBackground();
  startActionIcon();
});
