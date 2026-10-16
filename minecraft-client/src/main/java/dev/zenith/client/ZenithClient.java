package dev.zenith.client;

import com.mojang.blaze3d.platform.InputConstants;
import dev.zenith.client.command.ZenithCommands;
import dev.zenith.client.config.ConfigStore;
import dev.zenith.client.gui.HudEditorScreen;
import dev.zenith.client.gui.ZenithScreen;
import dev.zenith.client.hud.HudRenderer;
import dev.zenith.client.module.ModuleManager;
import dev.zenith.client.notification.Notifications;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class ZenithClient implements ClientModInitializer {
    public static final String MOD_ID = "zenith";
    public static final Logger LOG = LoggerFactory.getLogger("Zenith");
    private static ZenithClient instance;

    private ModuleManager modules;
    private ConfigStore config;
    private KeyMapping menuKey;
    private KeyMapping hudEditorKey;
    private KeyMapping zoomKey;
    private net.minecraft.client.gui.screens.Screen pendingScreen;

    public static ZenithClient get() {
        return instance;
    }

    public static String version() {
        return FabricLoader.getInstance().getModContainer(MOD_ID)
                .map(c -> c.getMetadata().getVersion().getFriendlyString()).orElse("dev");
    }

    @Override
    public void onInitializeClient() {
        instance = this;
        modules = ModuleManager.createDefault();
        config = new ConfigStore(FabricLoader.getInstance().getConfigDir().resolve("zenith"), modules);
        config.load();
        modules.setChangeListener(config::markDirty);
        Notifications.setEnabled(modules.get(dev.zenith.client.module.impl.ClientSettingsModule.class).notifications.get());

        menuKey = KeyBindingHelper.registerKeyBinding(new KeyMapping("key.zenith.menu", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_RIGHT_SHIFT, "category.zenith"));
        hudEditorKey = KeyBindingHelper.registerKeyBinding(new KeyMapping("key.zenith.hud_editor", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_UNKNOWN, "category.zenith"));
        zoomKey = KeyBindingHelper.registerKeyBinding(new KeyMapping("key.zenith.zoom", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_C, "category.zenith"));

        ClientTickEvents.END_CLIENT_TICK.register(this::onTick);
        HudRenderCallback.EVENT.register((graphics, delta) -> HudRenderer.render(graphics, modules, false));
        ScreenEvents.AFTER_INIT.register((client, screen, w, h) ->
                ScreenEvents.afterRender(screen).register((s, graphics, mx, my, pt) -> Notifications.render(graphics)));
        ClientCommandRegistrationCallback.EVENT.register((dispatcher, ctx) -> ZenithCommands.register(dispatcher));
        ClientLifecycleEvents.CLIENT_STOPPING.register(client -> config.save());
        LOG.info("Zenith Client {} initialised with {} modules", version(), modules.all().size());
    }

    private void onTick(Minecraft mc) {
        if (pendingScreen != null) {
            mc.setScreen(pendingScreen);
            pendingScreen = null;
        }
        while (menuKey.consumeClick()) {
            if (mc.screen == null) mc.setScreen(new ZenithScreen(null));
        }
        while (hudEditorKey.consumeClick()) {
            if (mc.screen == null) mc.setScreen(new HudEditorScreen(null));
        }
        modules.tick(mc);
        config.tick();
        Notifications.tick();
    }

    /** Opens a screen on the next tick (used by commands, whose chat screen closes after execution). */
    public void openNextTick(net.minecraft.client.gui.screens.Screen screen) {
        pendingScreen = screen;
    }

    public ModuleManager modules() {
        return modules;
    }

    public ConfigStore config() {
        return config;
    }

    public KeyMapping zoomKey() {
        return zoomKey;
    }

    public KeyMapping menuKey() {
        return menuKey;
    }
}
