# Firebase Security Specification

## Data Invariants
- An exam document must have a `userId` matching the authenticated user.
- `createdAt` must be a server timestamp.
- User can only read and write their own exams.
- Exam IDs must be valid.

## The Dirty Dozen Payloads
1. Attempt to create an exam with someone else's `userId`.
2. Attempt to read an exam without being signed in.
3. Attempt to read another user's exam.
4. Attempt to update `createdAt` after creation.
5. Attempt to update an exam with a 1MB string in `subject`.
6. Attempt to delete another user's exam.
7. Attempt to create an exam with a missing `userId`.
8. Attempt to create an exam with a non-string `subject`.
9. Attempt to create an exam with a malicious document ID (e.g., path traversal).
10. Attempt to update an exam's `userId`.
11. Attempt to list all exams from the collection without owner filtering.
12. Attempt to create an exam with a manually set `createdAt` that isn't the server time.

## Rules Logic Draft
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Default deny
    match /{document=**} {
      allow read, write: if false;
    }

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function isValidId(id) {
      return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$');
    }

    function isValidExam(data) {
      return data.userId == request.auth.uid 
        && data.subject is string && data.subject.size() <= 200
        && data.createdAt is timestamp;
    }

    match /exams/{examId} {
      allow get: if isOwner(resource.data.userId);
      allow list: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create: if isSignedIn() 
        && isValidExam(request.resource.data)
        && request.resource.data.createdAt == request.time;
      allow update: if isOwner(resource.data.userId)
        && isValidExam(request.resource.data)
        && request.resource.data.userId == resource.data.userId
        && request.resource.data.createdAt == resource.data.createdAt;
      allow delete: if isOwner(resource.data.userId);
    }
  }
}
```
