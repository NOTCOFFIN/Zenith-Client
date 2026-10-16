package dev.zenith.client.gui;

import dev.zenith.client.ZenithClient;
import dev.zenith.client.gui.widget.ZenithButton;
import dev.zenith.client.hud.HudModule;
import dev.zenith.client.hud.HudRenderer;
import dev.zenith.client.hud.Theme;
import dev.zenith.client.module.Category;
import dev.zenith.client.module.ModuleManager;
import dev.zenith.client.notification.Notifications;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** Drag HUD elements to move them, scroll to scale, right-click to hide. Positions persist to config. */
public final class HudEditorScreen extends Screen {
    private static final int SNAP = 4;
    private final Screen parent;
    private final ModuleManager modules;
    private HudModule dragging;
    private double grabX, grabY;

    public HudEditorScreen(Screen parent) {
        super(Component.literal("Zenith HUD Editor"));
        this.parent = parent;
        this.modules = ZenithClient.get().modules();
    }

    @Override protected void init() {
        int bw = 100;
        addRenderableWidget(new ZenithButton(width / 2 - bw - 4, height / 2 + 14, bw, 18, Component.literal("Modules"), false,
                () -> minecraft.setScreen(new ZenithScreen(this, Category.HUD))));
        addRenderableWidget(new ZenithButton(width / 2 + 4, height / 2 + 14, bw, 18, Component.literal("Reset layout"), false, () -> {
            for (HudModule m : modules.hud()) m.position().reset();
            ZenithClient.get().config().save();
            Notifications.info("HUD layout", "Positions reset to defaults");
        }));
        addRenderableWidget(new ZenithButton(width / 2 - 50, height / 2 + 38, 100, 18, Component.literal("Done"), true, this::onClose));
    }

    @Override public boolean isPauseScreen() { return false; }

    @Override public void onClose() {
        ZenithClient.get().config().save();
        minecraft.setScreen(parent);
    }

    @Override public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        if (minecraft.level == null) g.fillGradient(0, 0, width, height, 0xFF0B0D14, 0xFF111827);
        else g.fill(0, 0, width, height, 0x40000000);
        renderLayout(g, mouseX, mouseY);
    }

    private void renderLayout(GuiGraphics g, int mouseX, int mouseY) {
        g.fill(width / 2, 0, width / 2 + 1, height, 0x18FFFFFF);
        g.fill(0, height / 2, width, height / 2 + 1, 0x18FFFFFF);
        HudRenderer.render(g, modules, true);
        for (HudModule m : modules.hud()) {
            if (!m.enabled()) continue;
            int x = m.screenX(width), y = m.screenY(height);
            int w = (int) Math.ceil(m.width() * m.position().scale()), h = (int) Math.ceil(m.height() * m.position().scale());
            boolean hover = m == dragging || inside(m, mouseX, mouseY);
            g.renderOutline(x - 1, y - 1, w + 2, h + 2, hover ? Theme.BLUE : 0x60FFFFFF);
            if (hover) g.drawString(font, m.name() + " (" + Math.round(m.position().scale() * 100) + "%)", x, Math.max(0, y - 11), Theme.TEXT, true);
        }
        g.drawCenteredString(font, "HUD Editor", width / 2, height / 2 - 18, Theme.TEXT);
        g.drawCenteredString(font, "Drag to move \u2022 Scroll to scale \u2022 Right-click to hide", width / 2, height / 2 - 4, Theme.TEXT_DIM);
    }

    private boolean inside(HudModule m, double mx, double my) {
        int x = m.screenX(width), y = m.screenY(height);
        double w = m.width() * m.position().scale(), h = m.height() * m.position().scale();
        return mx >= x && mx < x + w && my >= y && my < y + h;
    }

    private HudModule at(double mx, double my) {
        var list = modules.hud();
        for (int i = list.size() - 1; i >= 0; i--) {
            HudModule m = list.get(i);
            if (m.enabled() && inside(m, mx, my)) return m;
        }
        return null;
    }

    @Override public boolean mouseClicked(double mx, double my, int button) {
        if (super.mouseClicked(mx, my, button)) return true;
        HudModule m = at(mx, my);
        if (m == null) return false;
        if (button == 1) {
            m.setEnabled(false);
            Notifications.info(m.name(), "Hidden \u2014 re-enable it from Modules");
            return true;
        }
        dragging = m;
        grabX = mx - m.screenX(width);
        grabY = my - m.screenY(height);
        return true;
    }

    @Override public boolean mouseDragged(double mx, double my, int button, double dx, double dy) {
        if (dragging == null) return super.mouseDragged(mx, my, button, dx, dy);
        double w = dragging.width() * dragging.position().scale();
        double h = dragging.height() * dragging.position().scale();
        double nx = mx - grabX, ny = my - grabY;
        if (Math.abs(nx + w / 2 - width / 2.0) < SNAP) nx = width / 2.0 - w / 2;
        if (Math.abs(ny + h / 2 - height / 2.0) < SNAP) ny = height / 2.0 - h / 2;
        double fx = width - w > 0 ? nx / (width - w) : 0;
        double fy = height - h > 0 ? ny / (height - h) : 0;
        dragging.position().set(fx, fy);
        return true;
    }

    @Override public boolean mouseReleased(double mx, double my, int button) {
        if (dragging != null) {
            dragging = null;
            ZenithClient.get().config().markDirty();
            return true;
        }
        return super.mouseReleased(mx, my, button);
    }

    @Override public boolean mouseScrolled(double mx, double my, double sx, double sy) {
        HudModule m = at(mx, my);
        if (m == null) return false;
        m.position().setScale(m.position().scale() + (sy > 0 ? 0.1 : -0.1));
        ZenithClient.get().config().markDirty();
        return true;
    }
}
