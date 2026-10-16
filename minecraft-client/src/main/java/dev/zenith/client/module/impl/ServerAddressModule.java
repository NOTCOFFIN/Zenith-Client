package dev.zenith.client.module.impl;

import dev.zenith.client.hud.HudModule;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.multiplayer.ServerData;

public final class ServerAddressModule extends HudModule {
    public ServerAddressModule() { super("server", "Server Address", "Shows the server you are connected to", false, 0.5, 0.0); }

    @Override protected int[] draw(GuiGraphics g, Minecraft mc, boolean preview) {
        ServerData data = mc.getCurrentServer();
        String text = data != null ? data.ip : mc.isLocalServer() ? "Singleplayer" : "Not connected";
        return text(g, mc, text);
    }
}
