package dev.zenith.client.module.impl;

import dev.zenith.client.hud.HudModule;
import dev.zenith.client.module.ClickTracker;
import dev.zenith.client.module.setting.BooleanSetting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

public final class CpsModule extends HudModule {
    private final BooleanSetting right = add(new BooleanSetting("right", "Include right click", true));

    public CpsModule() { super("cps", "CPS Counter", "Clicks per second over the last second", false, 0.0, 0.2); }

    @Override protected int[] draw(GuiGraphics g, Minecraft mc, boolean preview) {
        return text(g, mc, right.get() ? ClickTracker.leftCps() + " | " + ClickTracker.rightCps() + " CPS" : ClickTracker.leftCps() + " CPS");
    }
}
