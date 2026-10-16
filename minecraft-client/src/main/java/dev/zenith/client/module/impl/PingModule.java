package dev.zenith.client.module.impl;

import dev.zenith.client.hud.HudModule;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.multiplayer.PlayerInfo;

public final class PingModule extends HudModule {
    public PingModule() { super("ping", "Ping", "Round-trip latency reported by the server", false, 0.0, 0.26); }

    @Override protected int[] draw(GuiGraphics g, Minecraft mc, boolean preview) {
        String text = "Ping: --";
        if (mc.player != null && mc.getConnection() != null && !mc.isLocalServer()) {
            PlayerInfo info = mc.getConnection().getPlayerInfo(mc.player.getUUID());
            if (info != null) text = "Ping: " + info.getLatency() + " ms";
        } else if (mc.isLocalServer()) {
            text = "Ping: local";
        }
        return text(g, mc, text);
    }
}
