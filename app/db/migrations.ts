// migrations.ts
import { addColumns, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

const toVersion = 8;
export const schemaVersion = toVersion;
export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion,
      steps: [
        addColumns({
          table: 'users',
          columns: [
            { name: 'createdAt', type: 'number' },
            { name: 'updatedAt', type: 'number' },
          ],
        }),
        addColumns({
          table: 'configs',
          columns: [
            { name: 'createdAt', type: 'number' },
            { name: 'updatedAt', type: 'number' },
          ],
        }),
      ],
    },
  ],
});

// export async function updateTimestampsForExistingRecords(): Promise<void> {
//   const now = Date.now();
//
//   // Обновляем записи в таблице Users
//   const usersCollection = database.collections.get(Users.table);
//   const users = await usersCollection.query().fetch();
//   await database.write(async () => {
//     for (const user of users) {
//       // Если поле createdAt не установлено, обновляем запись
//       if (!user.createdAt) {
//         await user.update((record: any) => {
//           record.createdAt = now;
//           record.updatedAt = now;
//         });
//       }
//     }
//   });
//
//   // Обновляем записи в таблице Configs
//   const configsCollection = database.collections.get(Configs.table);
//   const configs = await configsCollection.query().fetch();
//   await database.write(async () => {
//     for (const config of configs) {
//       if (!config.createdAt) {
//         await config.update((record: any) => {
//           record.createdAt = now;
//           record.updatedAt = now;
//         });
//       }
//     }
//   });
// }
