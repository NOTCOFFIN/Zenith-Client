package dev.zenith.client.module.impl;

import dev.zenith.client.hud.HudModule;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

public final class FpsModule extends HudModule {
    public FpsModule() { super("fps", "FPS Display", "Shows the current frames per second", true, 0.0, 0.0); }

    @Override protected int[] draw(GuiGraphics g, Minecraft mc, boolean preview) {
        return text(g, mc, mc.getFps() + " FPS");
    }
}
