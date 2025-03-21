import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  query,
  where,
  orderBy,
  limit 
} from 'firebase/firestore';
import { generateMeetingId } from './utils';

// Firestore collection name
const MEETINGS_COLLECTION = 'meetings';

export interface MeetingData {
  id: string;
  title?: string;
  createdBy: string;
  createdAt: any; // Firestore Timestamp or JavaScript timestamp
  participants: {
    id: string;
    name: string;
    joinedAt?: number; // JavaScript timestamp (Date.now())
  }[];
  settings?: {
    allowChat?: boolean;
    allowScreenShare?: boolean;
    allowRecording?: boolean;
    waitingRoom?: boolean;
  };
  status: 'active' | 'ended';
}

// Create a new meeting in Firebase
export async function createMeeting(userId: string, userName: string, title?: string): Promise<string> {
  try {
    const meetingId = generateMeetingId();
    const meetingRef = doc(db, MEETINGS_COLLECTION, meetingId);
    
    const meetingData: MeetingData = {
      id: meetingId,
      title: title || 'Untitled Meeting',
      createdBy: userId,
      createdAt: serverTimestamp(),
      participants: [{
        id: userId,
        name: userName,
        joinedAt: Date.now()
      }],
      settings: {
        allowChat: true,
        allowScreenShare: true,
        allowRecording: true,
        waitingRoom: false
      },
      status: 'active'
    };
    
    await setDoc(meetingRef, meetingData);
    return meetingId;
  } catch (error) {
    console.error('Error creating meeting:', error);
    throw error;
  }
}

// Get meeting data
export async function getMeeting(meetingId: string): Promise<MeetingData | null> {
  try {
    const meetingRef = doc(db, MEETINGS_COLLECTION, meetingId);
    const meetingSnapshot = await getDoc(meetingRef);
    
    if (meetingSnapshot.exists()) {
      return meetingSnapshot.data() as MeetingData;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting meeting:', error);
    throw error;
  }
}

// Add participant to meeting
export async function joinMeeting(meetingId: string, userId: string, userName: string): Promise<void> {
  try {
    const meetingRef = doc(db, MEETINGS_COLLECTION, meetingId);
    const meetingSnapshot = await getDoc(meetingRef);
    
    if (!meetingSnapshot.exists()) {
      throw new Error('Meeting not found');
    }
    
    const meetingData = meetingSnapshot.data() as MeetingData;
    
    // Check if user is already in participants
    if (!meetingData.participants.some(p => p.id === userId)) {
      meetingData.participants.push({
        id: userId,
        name: userName,
        joinedAt: Date.now()
      });
      
      await updateDoc(meetingRef, {
        participants: meetingData.participants
      });
    }
  } catch (error) {
    console.error('Error joining meeting:', error);
    throw error;
  }
}

// Update participant status or remove from meeting
export async function leaveMeeting(meetingId: string, userId: string): Promise<void> {
  try {
    const meetingRef = doc(db, MEETINGS_COLLECTION, meetingId);
    const meetingSnapshot = await getDoc(meetingRef);
    
    if (!meetingSnapshot.exists()) {
      return; // Meeting doesn't exist, nothing to do
    }
    
    const meetingData = meetingSnapshot.data() as MeetingData;
    
    // Remove participant from meeting
    meetingData.participants = meetingData.participants.filter(p => p.id !== userId);
    
    // If meeting is empty after user leaves, mark it as ended
    if (meetingData.participants.length === 0) {
      await updateDoc(meetingRef, {
        participants: [],
        status: 'ended'
      });
    } else {
      await updateDoc(meetingRef, {
        participants: meetingData.participants
      });
    }
  } catch (error) {
    console.error('Error leaving meeting:', error);
    throw error;
  }
}

// End a meeting
export async function endMeeting(meetingId: string, userId: string): Promise<void> {
  try {
    const meetingRef = doc(db, MEETINGS_COLLECTION, meetingId);
    const meetingSnapshot = await getDoc(meetingRef);
    
    if (!meetingSnapshot.exists()) {
      throw new Error('Meeting not found');
    }
    
    const meetingData = meetingSnapshot.data() as MeetingData;
    
    // Only creator or admin can end the meeting
    if (meetingData.createdBy === userId) {
      await updateDoc(meetingRef, {
        status: 'ended',
        participants: [] // Clear participants when meeting ends
      });
    } else {
      throw new Error('Only the meeting creator can end the meeting');
    }
  } catch (error) {
    console.error('Error ending meeting:', error);
    throw error;
  }
}

// Get user's recent meetings
export async function getUserMeetings(userId: string, limitCount = 10): Promise<MeetingData[]> {
  try {
    const meetingsRef = collection(db, MEETINGS_COLLECTION);
    
    // First get meetings created by this user
    const createdByQuery = query(
      meetingsRef,
      where('createdBy', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const createdBySnapshot = await getDocs(createdByQuery);
    const meetings: MeetingData[] = [];
    
    createdBySnapshot.forEach((doc) => {
      meetings.push(doc.data() as MeetingData);
    });
    
    // Then get meetings where user is a participant but not creator
    // Note: Firestore doesn't support complex queries on arrays, so we need a different approach
    // This is a simplified version - for production, consider using a different data structure
    const allMeetingsQuery = query(
      meetingsRef,
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(50) // Get more meetings to filter through
    );
    
    const allMeetingsSnapshot = await getDocs(allMeetingsQuery);
    
    allMeetingsSnapshot.forEach((doc) => {
      const meetingData = doc.data() as MeetingData;
      
      // If we already have this meeting (as creator), skip it
      if (meetings.some(m => m.id === meetingData.id)) {
        return;
      }
      
      // Check if user is a participant
      if (meetingData.participants && 
          meetingData.participants.some(p => p.id === userId)) {
        meetings.push(meetingData);
      }
    });
    
    // Sort by createdAt (newest first) and limit to requested number
    return meetings
      .sort((a, b) => {
        const timeA = typeof a.createdAt === 'number' ? a.createdAt : 
                    a.createdAt?.toDate?.() ? a.createdAt.toDate().getTime() : 0;
        const timeB = typeof b.createdAt === 'number' ? b.createdAt : 
                    b.createdAt?.toDate?.() ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, limitCount);
  } catch (error) {
    console.error('Error getting user meetings:', error);
    throw error;
  }
} 