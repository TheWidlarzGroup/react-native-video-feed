package com.anonymous.VideoScrollExample

import android.view.View
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.margelo.nitro.video.HybridVideoPlayer
import com.twg.video.core.VideoManager

class CustomVideoControlsViewManager : SimpleViewManager<CustomVideoControlsView>() {
  
  override fun getName(): String {
    return "CustomVideoControlsView"
  }
  
  override fun createViewInstance(reactContext: ThemedReactContext): CustomVideoControlsView {
    return CustomVideoControlsView(reactContext)
  }
  
  @ReactProp(name = "nitroId")
  fun setNitroId(view: CustomVideoControlsView, nitroId: Int) {
    // Try to get the player from VideoManager using nitroId
    if (nitroId >= 0) {
      val player = VideoManager.getPlayerByNitroId(nitroId)
      if (player != null) {
        view.setPlayer(player)
        return
      }
    }
    // If nitroId is invalid or player not found, try to find from view hierarchy
    view.post {
      view.findPlayerFromViewHierarchy()
    }
  }
}

