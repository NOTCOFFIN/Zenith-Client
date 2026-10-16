package dev.zenith.client.module.impl;

import dev.zenith.client.hud.HudModule;
import dev.zenith.client.module.setting.ModeSetting;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

public final class ClockModule extends HudModule {
    private static final DateTimeFormatter H24 = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter H12 = DateTimeFormatter.ofPattern("h:mm a");
    private final ModeSetting format = add(new ModeSetting("format", "Format", "24h", "24h", "12h"));

    public ClockModule() { super("clock", "Clock", "Shows your local system time", false, 1.0, 0.0); }

    @Override protected int[] draw(GuiGraphics g, Minecraft mc, boolean preview) {
        return text(g, mc, LocalTime.now().format(format.is("12h") ? H12 : H24));
    }
}
