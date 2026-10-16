package dev.zenith.client.module.impl;

import dev.zenith.client.hud.HudModule;
import dev.zenith.client.hud.Theme;
import dev.zenith.client.module.ClickTracker;
import dev.zenith.client.module.setting.BooleanSetting;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

public final class KeystrokesModule extends HudModule {
    private final BooleanSetting mouse = add(new BooleanSetting("mouse", "Mouse buttons", true));
    private final BooleanSetting space = add(new BooleanSetting("space", "Space bar", true));
    private final BooleanSetting cps = add(new BooleanSetting("cps", "Show CPS on mouse", true));

    public KeystrokesModule() { super("keystrokes", "Keystrokes", "Shows movement keys and mouse buttons as you press them", false, 0.0, 0.85); }

    @Override protected int[] draw(GuiGraphics g, Minecraft mc, boolean preview) {
        int k = 22, gap = 2;
        int w = k * 3 + gap * 2;
        key(g, mc, mc.options.keyUp, "W", k + gap, 0, k, k);
        key(g, mc, mc.options.keyLeft, "A", 0, k + gap, k, k);
        key(g, mc, mc.options.keyDown, "S", k + gap, k + gap, k, k);
        key(g, mc, mc.options.keyRight, "D", (k + gap) * 2, k + gap, k, k);
        int y = (k + gap) * 2;
        if (mouse.get()) {
            int half = (w - gap) / 2;
            key(g, mc, mc.options.keyAttack, cps.get() ? ClickTracker.leftCps() + " CPS" : "LMB", 0, y, half, k);
            key(g, mc, mc.options.keyUse, cps.get() ? ClickTracker.rightCps() + " CPS" : "RMB", half + gap, y, w - half - gap, k);
            y += k + gap;
        }
        if (space.get()) {
            key(g, mc, mc.options.keyJump, "\u2014", 0, y, w, 12);
            y += 12 + gap;
        }
        return new int[] {w, y - gap};
    }

    private void key(GuiGraphics g, Minecraft mc, KeyMapping mapping, String label, int x, int y, int w, int h) {
        boolean down = mapping.isDown();
        if (background.get() || down) g.fill(x, y, x + w, y + h, down ? 0xD0FFFFFF : Theme.HUD_BG);
        int tw = mc.font.width(label);
        g.drawString(mc.font, label, x + (w - tw) / 2, y + (h - 8) / 2, down ? 0xFF0B0D14 : Theme.TEXT, !down);
    }
}
