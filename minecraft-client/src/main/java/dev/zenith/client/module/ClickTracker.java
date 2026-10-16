package dev.zenith.client.module;

import java.util.ArrayDeque;
import java.util.Deque;

/** Counts mouse clicks in a sliding one-second window; fed from MouseHandlerMixin. */
public final class ClickTracker {
    private static final Deque<Long> LEFT = new ArrayDeque<>();
    private static final Deque<Long> RIGHT = new ArrayDeque<>();

    private ClickTracker() {}

    public static synchronized void click(int button, long nowMs) {
        Deque<Long> q = button == 0 ? LEFT : button == 1 ? RIGHT : null;
        if (q == null) return;
        q.addLast(nowMs);
        prune(q, nowMs);
    }

    public static synchronized int cps(int button, long nowMs) {
        Deque<Long> q = button == 0 ? LEFT : RIGHT;
        prune(q, nowMs);
        return q.size();
    }

    public static int leftCps() { return cps(0, System.currentTimeMillis()); }
    public static int rightCps() { return cps(1, System.currentTimeMillis()); }

    public static synchronized void reset() {
        LEFT.clear();
        RIGHT.clear();
    }

    private static void prune(Deque<Long> q, long now) {
        while (!q.isEmpty() && now - q.peekFirst() >= 1000) q.removeFirst();
    }
}
