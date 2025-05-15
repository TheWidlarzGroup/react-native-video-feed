import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 20,
    zIndex: 2,
  },
  overlayRight: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginBottom: 96,
  },
  iconButton: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconLabel: {
    color: '#fff',
    fontSize: 16,
    marginTop: 4,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
    backgroundColor: 'rgba(0,0,0,0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 8,
    zIndex: 10,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
  },
}); 