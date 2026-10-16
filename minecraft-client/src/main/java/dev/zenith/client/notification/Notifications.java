package dev.zenith.client.notification;

import dev.zenith.client.hud.Theme;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.util.Mth;

/** Slide-in toast notifications rendered over the HUD and every screen. */
public final class Notifications {
    public enum Kind {
        INFO(Theme.BLUE), SUCCESS(Theme.GREEN), WARNING(Theme.AMBER), ERROR(Theme.RED);
        final int color;
        Kind(int color) { this.color = color; }
    }

    private record Entry(String title, String body, Kind kind, long createdAt, long durationMs) {}

    private static final int MAX_VISIBLE = 4;
    private static final Deque<Entry> ACTIVE = new ArrayDeque<>();
    private static boolean enabled = true;

    private Notifications() {}

    public static void setEnabled(boolean value) { enabled = value; }

    public static void push(Kind kind, String title, String body) {
        if (!enabled) return;
        synchronized (ACTIVE) {
            ACTIVE.addLast(new Entry(title, body == null ? "" : body, kind, System.currentTimeMillis(), 3500));
            while (ACTIVE.size() > 8) ACTIVE.removeFirst();
        }
    }

    public static void info(String title, String body) { push(Kind.INFO, title, body); }
    public static void success(String title, String body) { push(Kind.SUCCESS, title, body); }
    public static void warn(String title, String body) { push(Kind.WARNING, title, body); }
    public static void error(String title, String body) { push(Kind.ERROR, title, body); }

    public static int activeCount() {
        synchronized (ACTIVE) { return ACTIVE.size(); }
    }

    public static void tick() {
        long now = System.currentTimeMillis();
        synchronized (ACTIVE) {
            ACTIVE.removeIf(e -> now - e.createdAt > e.durationMs + 300);
        }
    }

    public static void render(GuiGraphics g) {
        List<Entry> snapshot;
        synchronized (ACTIVE) {
            if (ACTIVE.isEmpty()) return;
            snapshot = new ArrayList<>(ACTIVE);
        }
        Minecraft mc = Minecraft.getInstance();
        long now = System.currentTimeMillis();
        int y = g.guiHeight() - 8;
        int shown = 0;
        g.pose().pushPose();
        g.pose().translate(0, 0, 400);
        for (int i = snapshot.size() - 1; i >= 0 && shown < MAX_VISIBLE; i--, shown++) {
            Entry e = snapshot.get(i);
            long age = now - e.createdAt;
            float in = Mth.clamp(age / 200f, 0, 1);
            float out = Mth.clamp((e.durationMs + 300 - age) / 300f, 0, 1);
            float t = Math.min(in, out);
            float ease = 1 - (1 - t) * (1 - t) * (1 - t);
            int w = Math.max(140, Math.max(mc.font.width(e.title), mc.font.width(e.body)) + 20);
            int h = e.body.isEmpty() ? 20 : 30;
            int x = g.guiWidth() - (int) ((w + 8) * ease);
            y -= h + 4;
            g.fill(x, y, x + w, y + h, Theme.PANEL);
            g.fill(x, y, x + 2, y + h, e.kind.color);
            float progress = Mth.clamp(age / (float) e.durationMs, 0, 1);
            g.fill(x + 2, y + h - 1, x + 2 + (int) ((w - 2) * (1 - progress)), y + h, e.kind.color);
            g.drawString(mc.font, e.title, x + 8, y + 6, Theme.TEXT, false);
            if (!e.body.isEmpty()) g.drawString(mc.font, e.body, x + 8, y + 17, Theme.TEXT_DIM, false);
        }
        g.pose().popPose();
    }
}
