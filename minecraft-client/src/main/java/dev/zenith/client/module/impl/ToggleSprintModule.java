package dev.zenith.client.module.impl;

import com.mojang.blaze3d.platform.InputConstants;
import dev.zenith.client.module.Category;
import dev.zenith.client.module.Module;
import net.minecraft.client.Minecraft;

/** Keeps the sprint key held so you sprint whenever you move forward. */
public final class ToggleSprintModule extends Module {
    public ToggleSprintModule() { super("togglesprint", "Toggle Sprint", "Always sprint while moving forward", Category.MOVEMENT, false); }

    @Override public void tick(Minecraft mc) {
        if (mc.player == null) return;
        mc.options.keySprint.setDown(true);
    }

    @Override protected void onDisable() {
        Minecraft mc = Minecraft.getInstance();
        InputConstants.Key key = InputConstants.getKey(mc.options.keySprint.saveString());
        boolean physical = key.getType() == InputConstants.Type.KEYSYM && key.getValue() > 0
                && InputConstants.isKeyDown(mc.getWindow().getWindow(), key.getValue());
        mc.options.keySprint.setDown(physical);
    }
}
