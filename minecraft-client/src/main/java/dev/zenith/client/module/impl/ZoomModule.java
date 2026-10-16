package dev.zenith.client.module.impl;

import dev.zenith.client.ZenithClient;
import dev.zenith.client.module.Category;
import dev.zenith.client.module.Module;
import dev.zenith.client.module.setting.BooleanSetting;
import dev.zenith.client.module.setting.NumberSetting;
import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import org.lwjgl.glfw.GLFW;

/** Hold the zoom key (default C) to narrow the field of view. */
public final class ZoomModule extends Module {
    private final NumberSetting factor = add(new NumberSetting("factor", "Zoom factor", 4, 1.5, 10, 0.5));
    private final BooleanSetting smooth = add(new BooleanSetting("smooth", "Smooth transition", true));
    private final BooleanSetting cinematic = add(new BooleanSetting("cinematic", "Cinematic camera while zoomed", false));
    private double current = 1.0;
    private double previous = 1.0;
    private boolean forcedCinematic;

    public ZoomModule() { super("zoom", "Zoom", "Hold the Zoom key to magnify the view", Category.VISUAL, true); }

    public boolean active() {
        Minecraft mc = Minecraft.getInstance();
        return enabled() && mc.screen == null && ZenithClient.get() != null && isHeld(mc, ZenithClient.get().zoomKey());
    }

    /**
     * Vanilla only routes a key press to one KeyMapping per key, so a shared binding (C is also
     * "Save Hotbar Activator") can starve ours. Read the bound key's physical state instead.
     */
    private static boolean isHeld(Minecraft mc, KeyMapping mapping) {
        if (mapping.isDown()) return true;
        InputConstants.Key key = KeyBindingHelper.getBoundKeyOf(mapping);
        if (key.getValue() < 0) return false;
        long window = mc.getWindow().getWindow();
        return switch (key.getType()) {
            case KEYSYM -> InputConstants.isKeyDown(window, key.getValue());
            case MOUSE -> GLFW.glfwGetMouseButton(window, key.getValue()) == GLFW.GLFW_PRESS;
            default -> false;
        };
    }

    @Override public void tick(Minecraft mc) {
        previous = current;
        double target = active() ? factor.get() : 1.0;
        current = smooth.get() ? current + (target - current) * 0.5 : target;
        if (Math.abs(current - target) < 0.01) current = target;
        boolean wantCinematic = active() && cinematic.get();
        if (wantCinematic && !mc.options.smoothCamera) {
            mc.options.smoothCamera = true;
            forcedCinematic = true;
        } else if (!wantCinematic && forcedCinematic) {
            mc.options.smoothCamera = false;
            forcedCinematic = false;
        }
    }

    @Override protected void onDisable() {
        current = previous = 1.0;
        if (forcedCinematic) {
            Minecraft.getInstance().options.smoothCamera = false;
            forcedCinematic = false;
        }
    }

    /** Divisor applied to the FOV this frame. */
    public double divisor(float partialTick) {
        if (!enabled()) return 1.0;
        return previous + (current - previous) * partialTick;
    }
}
