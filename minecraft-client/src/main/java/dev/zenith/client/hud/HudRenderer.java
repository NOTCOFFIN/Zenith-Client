package dev.zenith.client.hud;

import dev.zenith.client.module.ModuleManager;
import dev.zenith.client.notification.Notifications;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

public final class HudRenderer {
    private HudRenderer() {}

    public static void render(GuiGraphics g, ModuleManager modules, boolean preview) {
        Minecraft mc = Minecraft.getInstance();
        if (!preview && (mc.options.hideGui || mc.getDebugOverlay().showDebugScreen())) {
            Notifications.render(g);
            return;
        }
        int w = g.guiWidth();
        int h = g.guiHeight();
        for (HudModule m : modules.hud()) {
            if (m.enabled()) m.render(g, mc, w, h, preview);
        }
        if (mc.screen == null) Notifications.render(g);
    }
}
