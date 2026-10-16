package dev.zenith.client.module.impl;

import dev.zenith.client.hud.HudModule;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

public final class MemoryModule extends HudModule {
    public MemoryModule() { super("memory", "Memory Usage", "Java heap in use versus the maximum allocated", false, 0.0, 0.32); }

    @Override protected int[] draw(GuiGraphics g, Minecraft mc, boolean preview) {
        Runtime rt = Runtime.getRuntime();
        long used = (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024);
        long max = rt.maxMemory() / (1024 * 1024);
        return text(g, mc, "RAM: " + used + " / " + max + " MB");
    }
}
