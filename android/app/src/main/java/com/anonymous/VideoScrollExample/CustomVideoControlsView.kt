package com.anonymous.VideoScrollExample

import android.content.Context
import android.util.AttributeSet
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.ViewParent
import android.widget.FrameLayout
import android.widget.ImageView
import com.margelo.nitro.video.HybridVideoPlayer
import com.twg.video.view.VideoView

class CustomVideoControlsView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
  defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {
  
  private var playPauseButton: ImageView? = null
  private var backgroundOverlay: View? = null
  private var player: HybridVideoPlayer? = null
  private var pollingRunnable: Runnable? = null
  private var isPlayingState: Boolean = false
  
  init {
    Log.d("CustomVideoControls", "CustomVideoControlsView created")
    setupPlayPauseButton()
    post {
      Log.d("CustomVideoControls", "Starting to find player from view hierarchy")
      findPlayerFromViewHierarchy()
    }
  }
  
  fun findPlayerFromViewHierarchy() {
    if (player != null) {
      Log.d("CustomVideoControls", "Player already found, skipping")
      return
    }
    
    val parentView = parent as? ViewGroup ?: run {
      Log.d("CustomVideoControls", "Parent is not a ViewGroup")
      postDelayed({ findPlayerFromViewHierarchy() }, 200)
      return
    }
    
    Log.d("CustomVideoControls", "Searching for VideoView in parent: ${parentView.javaClass.simpleName}")
    
    fun searchInViewGroup(viewGroup: ViewGroup): HybridVideoPlayer? {
      for (i in 0 until viewGroup.childCount) {
        val child = viewGroup.getChildAt(i)
        Log.d("CustomVideoControls", "Checking child $i: ${child.javaClass.simpleName}")
        
        if (child is VideoView) {
          val videoView = child as VideoView
          val foundPlayer = videoView.hybridPlayer
          Log.d("CustomVideoControls", "Found VideoView! player=$foundPlayer")
          return foundPlayer
        }
        
        if (child is ViewGroup) {
          val found = searchInViewGroup(child)
          if (found != null) return found
        }
      }
      return null
    }
    
    val foundPlayer = searchInViewGroup(parentView)
    if (foundPlayer != null) {
      Log.d("CustomVideoControls", "Found player from view hierarchy!")
      setPlayer(foundPlayer)
    } else {
      Log.d("CustomVideoControls", "Player not found, retrying...")
      postDelayed({
        findPlayerFromViewHierarchy()
      }, 200)
    }
  }
  
  private fun setupPlayPauseButton() {
    backgroundOverlay = View(context).apply {
      layoutParams = FrameLayout.LayoutParams(
        (120 * resources.displayMetrics.density).toInt(),
        (120 * resources.displayMetrics.density).toInt()
      ).apply {
        gravity = Gravity.CENTER
      }
      background = android.graphics.drawable.GradientDrawable().apply {
        shape = android.graphics.drawable.GradientDrawable.OVAL
        setColor(android.graphics.Color.parseColor("#40000000"))
      }
      visibility = View.GONE
    }
    
    playPauseButton = ImageView(context).apply {
      layoutParams = FrameLayout.LayoutParams(
        (80 * resources.displayMetrics.density).toInt(),
        (80 * resources.displayMetrics.density).toInt()
      ).apply {
        gravity = Gravity.CENTER
      }
      scaleType = ImageView.ScaleType.FIT_CENTER
      isClickable = true
      isFocusable = true
      isEnabled = true
      setOnClickListener {
        Log.d("CustomVideoControls", "Button clicked!")
        togglePlayPause()
      }
      setImageResource(androidx.media3.ui.R.drawable.exo_icon_play)
      visibility = View.VISIBLE
    }
    
    isClickable = false
    isFocusable = false
    
    addView(backgroundOverlay)
    addView(playPauseButton)
    Log.d("CustomVideoControls", "Button setup complete, initial visibility=VISIBLE")
  }
  
  fun setPlayer(player: HybridVideoPlayer?) {
    Log.d("CustomVideoControls", "setPlayer called with player=${player != null}")
    stopPolling()
    this.player = player
    
    if (player != null) {
      try {
        val initialPlayingState = player.isPlaying
        isPlayingState = initialPlayingState
        Log.d("CustomVideoControls", "Initial player state: isPlaying=$initialPlayingState")
      } catch (e: Exception) {
        Log.e("CustomVideoControls", "Error getting initial isPlaying: ${e.message}")
      }
      startPolling()
      updateButtonVisibility()
    } else {
      updateButtonVisibility()
    }
  }
  
  private fun startPolling() {
    stopPolling()
    
    pollingRunnable = Runnable {
      updateButtonVisibility()
      if (player != null) {
        postDelayed(pollingRunnable!!, 100)
      }
    }
    post(pollingRunnable!!)
  }
  
  private fun stopPolling() {
    pollingRunnable?.let { removeCallbacks(it) }
    pollingRunnable = null
  }
  
  private fun updateButtonVisibility() {
    val currentPlayer = player
    
    if (currentPlayer == null) {
      playPauseButton?.visibility = View.GONE
      backgroundOverlay?.visibility = View.GONE
      Log.d("CustomVideoControls", "updateButtonVisibility: No player, hiding button")
      return
    }
    
    try {
      isPlayingState = currentPlayer.isPlaying
    } catch (e: Exception) {
      Log.e("CustomVideoControls", "Error checking isPlaying: ${e.message}")
    }
    
    val iconRes = if (isPlayingState) {
      androidx.media3.ui.R.drawable.exo_icon_pause
    } else {
      androidx.media3.ui.R.drawable.exo_icon_play
    }
    playPauseButton?.setImageResource(iconRes)
    
    val visibility = if (isPlayingState) {
      View.GONE
    } else {
      View.VISIBLE
    }
    playPauseButton?.visibility = visibility
    backgroundOverlay?.visibility = visibility
    
    Log.d("CustomVideoControls", "updateButtonVisibility: isPlaying=$isPlayingState, visibility=$visibility, hasPlayer=true")
  }
  
  private fun togglePlayPause() {
    val currentPlayer = player
    if (currentPlayer == null) {
      Log.e("CustomVideoControls", "Cannot toggle: player is null")
      return
    }
    
    try {
      val wasPlaying = currentPlayer.isPlaying
      Log.d("CustomVideoControls", "togglePlayPause: wasPlaying=$wasPlaying")
      
      if (wasPlaying) {
        currentPlayer.pause()
        isPlayingState = false
        Log.d("CustomVideoControls", "Paused video")
      } else {
        currentPlayer.play()
        isPlayingState = true
        Log.d("CustomVideoControls", "Playing video")
      }
      
      post {
        updateButtonVisibility()
      }
    } catch (e: Exception) {
      Log.e("CustomVideoControls", "Error toggling play/pause: ${e.message}", e)
    }
  }
  
  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    stopPolling()
  }
}
