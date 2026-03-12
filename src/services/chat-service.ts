'use client';
    
import {
  addDoc,
  collection,
  serverTimestamp,
  Firestore
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface MessageData {
    uid: string;
    playerName: string;
    text: string;
}

/**
 * Initiates an addDoc operation to send a chat message.
 * Does NOT await the write operation internally.
 */
export function sendChatMessage(db: Firestore, worldId: string, messageData: MessageData) {
    if (!messageData.text.trim()) return;

    const colRef = collection(db, 'worlds', worldId, 'messages');
    const dataWithTimestamp = {
        ...messageData,
        timestamp: serverTimestamp()
    };
  
    addDoc(colRef, dataWithTimestamp)
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: colRef.path,
          operation: 'create',
          requestResourceData: dataWithTimestamp,
        })
      )
    });
}
