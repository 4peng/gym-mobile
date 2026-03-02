'use client';

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useWorkoutSessionStore } from '@/src/stores/workoutSessionStore';
import { generateId } from '@/src/utils/id';
import { USER_ID } from '@/src/constants/user';
import { COLORS } from '@/src/constants/colors';
import { useRouter } from 'expo-router';

export default function MockDataInjector() {
  const router = useRouter();
  const [status, setStatus] = useState('Ready to inject 90 days of data');
  
  const injectData = () => {
    setStatus('Injecting...');
    
    const history = [];
    const now = new Date();
    
    // Create 3 routine types
    const routines = [
      { name: 'Push Day', exercises: ['Bench Press', 'Overhead Press', 'Tricep Pushdowns'] },
      { name: 'Pull Day', exercises: ['Deadlift', 'Pullups', 'Bicep Curls'] },
      { name: 'Legs', exercises: ['Squat', 'Leg Press', 'Calf Raises'] }
    ];

    // Inject every ~2 days for 90 days
    for (let i = 90; i >= 0; i -= 2) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const routine = routines[Math.floor(Math.random() * routines.length)];
      
      // Simulate progressive overload (weights go up over time)
      const progressFactor = (90 - i) / 10; // weight increases by ~1kg every session
      
      const session = {
        _id: generateId(),
        userId: USER_ID,
        startedAt: date.toISOString(),
        completedAt: new Date(date.getTime() + 3600000).toISOString(),
        updatedAt: Date.now(),
        exercises: routine.exercises.map(exName => ({
          id: generateId(),
          name: exName,
          sets: [
            { id: generateId(), weight: 40 + progressFactor, reps: 10, completedAt: date.toISOString() },
            { id: generateId(), weight: 40 + progressFactor, reps: 10, completedAt: date.toISOString() },
            { id: generateId(), weight: 40 + progressFactor, reps: 10, completedAt: date.toISOString() }
          ],
          weightUnit: 'kg' as const
        }))
      };
      
      history.push(session);
    }

    // Directly access store to set history
    useWorkoutSessionStore.setState((state) => ({
      history: [...history, ...state.history],
      isDirty: true
    }));

    setStatus(`Success! Injected ${history.length} sessions.`);
    setTimeout(() => router.replace('/programs/'), 1500);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mock Data Injector</Text>
      <Text style={styles.status}>{status}</Text>
      
      <Pressable style={styles.btn} onPress={injectData}>
        <Text style={styles.btnText}>Inject 90 Days of History</Text>
      </Pressable>

      <Pressable style={[styles.btn, { backgroundColor: '#333', marginTop: 20 }]} onPress={() => router.back()}>
        <Text style={styles.btnText}>Go Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG, justifyContent: 'center', padding: 40 },
  title: { color: 'white', fontSize: 32, fontWeight: '900', marginBottom: 20, textAlign: 'center' },
  status: { color: COLORS.TEXT_SECONDARY, fontSize: 16, marginBottom: 40, textAlign: 'center' },
  btn: { backgroundColor: COLORS.ACCENT_BLUE, padding: 20, borderRadius: 20, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 18 }
});
