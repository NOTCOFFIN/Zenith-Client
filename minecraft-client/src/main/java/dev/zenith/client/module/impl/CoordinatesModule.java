package dev.zenith.client.module.impl;

import dev.zenith.client.hud.HudModule;
import dev.zenith.client.hud.Theme;
import dev.zenith.client.module.setting.BooleanSetting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

public final class CoordinatesModule extends HudModule {
    private final BooleanSetting direction = add(new BooleanSetting("direction", "Show facing", true));
    private final BooleanSetting decimals = add(new BooleanSetting("decimals", "Decimals", false));

    public CoordinatesModule() { super("coordinates", "Coordinates", "Shows your XYZ position and facing", true, 0.0, 0.06); }

    @Override protected int[] draw(GuiGraphics g, Minecraft mc, boolean preview) {
        double x = 0, y = 64, z = 0;
        String facing = "North";
        if (mc.player != null) {
            x = mc.player.getX();
            y = mc.player.getY();
            z = mc.player.getZ();
            String dir = mc.player.getDirection().getName();
            facing = Character.toUpperCase(dir.charAt(0)) + dir.substring(1);
        }
        String fmt = decimals.get() ? "%.1f" : "%.0f";
        String[] lines = direction.get()
                ? new String[] {"X " + String.format(java.util.Locale.ROOT, fmt, x), "Y " + String.format(java.util.Locale.ROOT, fmt, y), "Z " + String.format(java.util.Locale.ROOT, fmt, z), facing}
                : new String[] {"X " + String.format(java.util.Locale.ROOT, fmt, x), "Y " + String.format(java.util.Locale.ROOT, fmt, y), "Z " + String.format(java.util.Locale.ROOT, fmt, z)};
        int w = 0;
        for (String l : lines) w = Math.max(w, mc.font.width(l));
        w += 8;
        int h = lines.length * 10 + 4;
        if (background.get()) g.fill(0, 0, w, h, Theme.HUD_BG);
        for (int i = 0; i < lines.length; i++) g.drawString(mc.font, lines[i], 4, 3 + i * 10, i == 3 ? Theme.TEXT_DIM : Theme.TEXT, true);
        return new int[] {w, h};
    }
}
