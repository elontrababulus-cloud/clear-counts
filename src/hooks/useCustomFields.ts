import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CustomFieldDefinition } from '@/types';

export function useCustomFields(entity: CustomFieldDefinition['entity']) {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'custom_fields'),
      where('entity', '==', entity),
      orderBy('order', 'asc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as CustomFieldDefinition[];
      setFields(data);
      setLoading(false);
    });

    return unsub;
  }, [entity]);

  return { fields, loading };
}
