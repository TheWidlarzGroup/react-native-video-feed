package com.anonymous.VideoScrollExample

import android.content.Context
import android.util.AttributeSet
import android.view.Gravity
import android.view.View
import android.view.ViewParent
import android.widget.FrameLayout
import android.widget.ImageView
import com.margelo.nitro.video.HybridVideoPlayer
import com.twg.video.core.VideoManager
import com.twg.video.view.VideoView

class CustomVideoControlsView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
  defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {
  
  private var playPauseButton: ImageView? = null
  private var player: HybridVideoPlayer? = null
  private var pollingRunnable: Runnable? = null
  
  init {
    setupPlayPauseButton()
    // Try to find the player from the nearest VideoView in the view hierarchy
    post {
      findPlayerFromViewHierarchy()
    }
  }
  
  fun findPlayerFromViewHierarchy() {
    var currentParent: ViewParent? = parent
    while (currentParent != null) {
      if (currentParent is View) {
        val view = currentParent as View
        if (view is VideoView) {
          val videoView = view as VideoView
          val player = videoView.hybridPlayer
          if (player != null) {
            setPlayer(player)
            return
          }
        }
        currentParent = view.parent
      } else {
        break
      }
    }
  }
  
  private fun setupPlayPauseButton() {
    playPauseButton = ImageView(context).apply {
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.WRAP_CONTENT,
        FrameLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        gravity = Gravity.CENTER
      }
      scaleType = ImageView.ScaleType.FIT_CENTER
      isClickable = true
      isFocusable = true
      setOnClickListener {
        togglePlayPause()
      }
      visibility = View.VISIBLE
    }
    addView(playPauseButton)
    updatePlayPauseButtonIcon()
  }
  
  fun setPlayer(player: HybridVideoPlayer?) {
    // Stop polling old player
    stopPollingPlaybackState()
    
    this.player = player
    
    // Update button icon when player is set
    updatePlayPauseButtonIcon()
    
    // Start polling for playback state changes
    startPollingPlaybackState()
  }
  
  private fun startPollingPlaybackState() {
    stopPollingPlaybackState()
    var lastPlayingState = player?.isPlaying ?: false
    
    pollingRunnable = Runnable {
      val currentPlayingState = player?.isPlaying ?: false
      if (currentPlayingState != lastPlayingState) {
        lastPlayingState = currentPlayingState
        updatePlayPauseButtonIcon()
      }
      if (player != null) {
        postDelayed(pollingRunnable!!, 100) // Poll every 100ms
      }
    }
    post(pollingRunnable!!)
  }
  
  private fun stopPollingPlaybackState() {
    pollingRunnable?.let { removeCallbacks(it) }
    pollingRunnable = null
  }
  
  private fun updatePlayPauseButtonIcon() {
    val isPlaying = player?.isPlaying ?: false
    val iconRes = if (isPlaying) {
      androidx.media3.ui.R.drawable.exo_icon_pause
    } else {
      androidx.media3.ui.R.drawable.exo_icon_play
    }
    playPauseButton?.setImageResource(iconRes)
  }
  
  private fun togglePlayPause() {
    val playerInstance = player ?: return
    if (playerInstance.isPlaying) {
      playerInstance.pause()
    } else {
      playerInstance.play()
    }
    // Update icon immediately
    updatePlayPauseButtonIcon()
  }
  
  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    stopPollingPlaybackState()
  }
}
