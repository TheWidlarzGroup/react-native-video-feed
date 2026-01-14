import { FontAwesome, Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { styles } from "../styles";

const BottomTabBar = () => (
    <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem}>
            <Ionicons name="home" size={28} color="#fff" />
            <Text style={styles.tabLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
            <Ionicons name="search" size={28} color="#fff" />
            <Text style={styles.tabLabel}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
            <FontAwesome name="plus-square" size={32} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
            <Ionicons name="chatbubble-ellipses" size={28} color="#fff" />
            <Text style={styles.tabLabel}>Inbox</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
            <Ionicons name="person" size={28} color="#fff" />
            <Text style={styles.tabLabel}>Profile</Text>
        </TouchableOpacity>
    </View>
);

export default BottomTabBar;
